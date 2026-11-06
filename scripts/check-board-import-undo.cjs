// Run with: node scripts/check-board-import-undo.cjs
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const { undoBoardImport, IMPORT_UNDO_SLOT_FIELDS } = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/agreements/placement/boardImportUndo.js')).href);
  const empty = () => Array(5).fill(null);
  const original = { id: 'original', name: '기존업체', bizNo: '1000000000' };
  const added = { id: 'added', name: '불러온업체', bizNo: '2000000000', _agreementRegionImported: true };
  const assignedBefore = [['rep-original', null, null, null, null], empty()];
  const assignedAfter = [assignedBefore[0].slice(), [null, 'region-added', null, null, null], ['rep-added2', null, null, null, null]];
  const added2 = { ...added, id: 'added2', bizNo: '3000000000' };
  const transaction = {
    title: '지역사불러오기', beforeCandidates: [original], afterCandidates: [original, added, added2],
    beforeExcluded: ['unrelated-excluded'], afterExcluded: ['unrelated-excluded'],
    beforeAssignments: assignedBefore, afterAssignments: assignedAfter,
    beforeSlotValues: Object.fromEntries(IMPORT_UNDO_SLOT_FIELDS.map((field) => [field, [['80', '', '', '', ''], ['', '', '', '', '']]])),
  };
  const participantMap = new Map([
    ['rep-original', { candidate: original }], ['region-added', { candidate: added }], ['rep-added2', { candidate: added2 }],
  ]);
  const current = {
    candidates: [original, added, added2], excluded: ['unrelated-excluded'], participantMap,
    groupAssignments: assignedAfter, groupApprovals: ['', '', ''], groupManagementBonus: [false, false, false],
    ...Object.fromEntries(IMPORT_UNDO_SLOT_FIELDS.map((field) => [field, [['85', '', '', '', ''], ['', '20', '', '', ''], ['100', '', '', '', '']]])),
  };
  const result = undoBoardImport(current, transaction);
  assert.deepEqual(result.groupAssignments, assignedBefore);
  assert.equal(result.groupShares[0][0], '85', 'keep subsequent manual edits to original company');
  assert.deepEqual(result.candidates, [original]);
  assert.deepEqual(result.excluded, ['unrelated-excluded']);
  assert.equal(result.removedCount, 2);
  assert.equal(result.removedRows, 1);
  assert.equal(current.groupAssignments[1][1], 'region-added', 'do not mutate live state');

  const manual = { id: 'manual', name: '직접추가업체' };
  const withManual = {
    ...current, candidates: [...current.candidates, manual],
    participantMap: new Map([...participantMap, ['rep-manual', { candidate: manual }]]),
    groupAssignments: [assignedAfter[0].slice(), assignedAfter[1].slice(), ['rep-added2', 'rep-manual', null, null, null]],
  };
  const preserved = undoBoardImport(withManual, transaction);
  assert.equal(preserved.groupAssignments.length, 3, 'keep imported row used by a manually added company');
  assert.equal(preserved.groupAssignments[2][1], 'rep-manual');
  assert.equal(preserved.candidates.some((company) => company.id === 'manual'), true);
  assert.equal(preserved.candidates.some((company) => company.id === 'added'), false);

  const approved = undoBoardImport({ ...current, groupApprovals: ['', '', '참고사항'] }, transaction);
  assert.equal(approved.groupAssignments.length, 3, 'keep a row with later manual approval text');
  const extraRow = undoBoardImport({ ...current, groupAssignments: [...assignedAfter, empty()] }, transaction);
  assert.equal(extraRow.groupAssignments.length, 4, 'do not trim separately added rows');

  const oldUnassigned = { id: 'unassigned', name: '기존후보', bizNo: '4000000000', customNote: '기존 메모' };
  const selected = { ...oldUnassigned, _agreementRegionImported: true, customNote: '수정 메모' };
  const reuseTransaction = {
    title: '고정업체 불러오기', beforeCandidates: [oldUnassigned], afterCandidates: [{...selected}],
    beforeExcluded: ['unassigned'], afterExcluded: [], beforeAssignments: [empty()],
    afterAssignments: [[null, 'region-unassigned', null, null, null]], beforeSlotValues: {},
  };
  const reused = undoBoardImport({
    ...current, candidates: [selected], excluded: [],
    participantMap: new Map([['region-unassigned', {candidate: selected}]]),
    groupAssignments: reuseTransaction.afterAssignments,
  }, reuseTransaction);
  assert.equal(reused.candidates[0].customNote, '수정 메모', 'preserve candidate edits while restoring selection flag');
  assert.equal(Object.hasOwn(reused.candidates[0], '_agreementRegionImported'), false);
  assert.deepEqual(reused.excluded, ['unassigned']);

  const pooled = undoBoardImport({ ...current, candidates: [original, {...added, _agreementCandidateListed:true}, added2] }, transaction);
  assert.equal(pooled.candidates.some((company) => company.id === 'added'), true, 'keep a company manually added to the candidate pool');

  const moved = undoBoardImport({ ...current, groupAssignments: [[...assignedAfter[0]], empty(), [null, null, 'region-added', null, null]] }, transaction);
  assert.equal(moved.groupAssignments.flat().includes('region-added'), false, 'remove the imported company after moving it');
  console.log('PASS: import undo, inserted rows, original companies, manual edits/additions, row notes, candidate reuse, selection/exclusion restoration, pool preservation, moved imports, immutable state');
})().catch((error) => { console.error(error); process.exitCode = 1; });
