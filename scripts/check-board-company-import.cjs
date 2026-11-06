// Run with: node scripts/check-board-company-import.cjs
// Exercises the import hook with in-memory React state and mock board data.
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { pathToFileURL } = require('node:url');
const esbuild = require('esbuild');

const hookPath = path.resolve(__dirname, '../src/view/features/agreements/hooks/useBoardCompanyImport.js');
const compiled = esbuild.buildSync({ entryPoints: [hookPath], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false });
const emptyRow = () => Array(5).fill(null);
const undoHookPath = path.resolve(__dirname, '../src/view/features/agreements/hooks/useBoardImportUndo.js');
const compiledUndo = esbuild.buildSync({ entryPoints: [undoHookPath], bundle: true, platform: 'node', format: 'cjs', packages: 'external', write: false });

function createBoard(companies, rows, enableUndo = false) {
  let undoResult;
  const slots = [];
  let cursor = 0;
  let effects = [];
  let dirty = false;
  let result;
  const notices = [];
  const equalDeps = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const react = {
    useRef(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: value };
      return slots[index];
    },
    useState(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = value;
      return [slots[index], (next) => {
        const value = typeof next === 'function' ? next(slots[index]) : next;
        if (!Object.is(value, slots[index])) { slots[index] = value; dirty = true; }
      }];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) slots[index] = { deps, callback };
      return slots[index].callback;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) {
        slots[index] = { deps };
        effects.push(callback);
      }
    },
  };
  const module = new Module(hookPath);
  module.paths = Module._nodeModulePaths(path.resolve(__dirname, '..'));
  module.require = (name) => name === 'react' ? react : Module.prototype.require.call(module, name);
  module._compile(compiled.outputFiles[0].text, hookPath);
  const hook = module.exports.default;
  const undoModule = new Module(undoHookPath);
  undoModule.paths = module.paths;
  undoModule.require = module.require;
  undoModule._compile(compiledUndo.outputFiles[0].text, undoHookPath);
  const undoHook = undoModule.exports.default;
  const board = {
    context: { ownerId: 'MOIS', menuKey: 'mois-30to50', fileType: 'eung', dutyRegions: ['서울'] },
    open: true, candidates: companies, excluded: [], groupAssignments: rows, safeGroupSize: 5,
    buildRegionSearchPayload: () => board.context,
    loadCompanies: async () => [], validateImport: () => '', title: '업체 불러오기 검증',
    notify: (notice) => notices.push(notice), portalContainer: null,
    setGroupAssignments: (next) => { board.groupAssignments = next; dirty = true; },
    onUpdateBoard: (next) => { Object.assign(board, next); updateParticipants(); dirty = true; },
  };
  if (enableUndo) {
    board.resetKey = 'current-board';
    board.markSkipAssignmentSync = () => {};
    board.onUndoApplied = () => {};
    board.setters = {};
    for (const field of ['groupShares', 'groupShareRawInputs', 'groupCredibility', 'groupTechnicianScores', 'groupQualityScores', 'groupApprovals', 'groupManagementBonus']) {
      board[field] = field === 'groupApprovals' ? rows.map(() => '')
        : field === 'groupManagementBonus' ? rows.map(() => false) : rows.map(() => Array(5).fill(''));
      board.setters[field] = (value) => { board[field] = value; dirty = true; };
    }
  }
  function updateParticipants() {
    board.participantMap = new Map(board.candidates.map((candidate) => [`region-${candidate.id}`, { uid: `region-${candidate.id}`, candidate }]));
  }
  updateParticipants();
  function flush() {
    for (let pass = 0; pass < 20; pass += 1) {
      cursor = 0; effects = []; dirty = false;
      if (enableUndo) {
        undoResult = undoHook(board);
        board.onImportApplied = undoResult.recordImport;
      }
      result = hook(board);
      effects.forEach((effect) => effect());
      if (!dirty) return result;
    }
    throw new Error('Import hook did not settle');
  }
  return { board, notices, flush, get result() { return result; }, get undo() { return undoResult; } };
}

(async () => {
  const { resolveFixedCompanyPlacementSlot } = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/agreements/fixedCompanyImport.js')).href);
  const { placeRegionEntries } = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/agreements/placement/regionImport.js')).href);
  const fixedContext = { dutyRegions: ['충북'] };
  assert.equal(resolveFixedCompanyPlacementSlot({ region: '충청북도' }, fixedContext), 1);
  assert.equal(resolveFixedCompanyPlacementSlot({ region: '경기' }, fixedContext), 0);
  assert.equal(resolveFixedCompanyPlacementSlot({ snapshot: { 대표지역: '충북' } }, fixedContext), 1);
  assert.equal(resolveFixedCompanyPlacementSlot({ region: '경기도' }, { dutyRegions: ['충북', '경기'] }), 1);
  const fixed = createBoard([], [emptyRow(), emptyRow()]);
  fixed.board.context = { ...fixed.board.context, ...fixedContext };
  fixed.board.loadCompanies = async () => [
    { id: 'local', bizNo: '1234567890', name: '충북업체', region: '충청북도' },
    { id: 'leader', bizNo: '9876543210', name: '경기업체', region: '경기' },
  ];
  fixed.board.placeEntries = (rows, entries, size, context) => placeRegionEntries(rows, entries, size,
    (entry) => resolveFixedCompanyPlacementSlot(entry.candidate, context));
  fixed.flush(); await fixed.result.importCompanies(); fixed.flush();
  assert.deepEqual(fixed.board.groupAssignments[0], [null, 'region-local', null, null, null]);
  assert.deepEqual(fixed.board.groupAssignments[1], ['region-leader', null, null, null, null]);
  await fixed.result.importCompanies(); fixed.flush();
  assert.equal(fixed.board.groupAssignments.length, 2, 'fixed import remains idempotent across both roles');

  const { placeOwnCorporationEntries } = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/agreements/ownCorporationImport.js')).href);
  const own = createBoard([], [emptyRow()]);
  own.board.context = { ...own.board.context, ...fixedContext };
  own.board.loadCompanies = fixed.board.loadCompanies;
  own.board.placeEntries = placeOwnCorporationEntries;
  own.flush(); await own.result.importCompanies(); own.flush();
  assert.deepEqual(own.board.groupAssignments[0], ['region-local', null, null, null, null], 'own local corporation belongs in leader slot');
  assert.deepEqual(own.board.groupAssignments[1], ['region-leader', null, null, null, null], 'own nonlocal corporation belongs in leader slot');
  await own.result.importCompanies(); own.flush();
  assert.equal(own.board.groupAssignments.length, 2, 'repeat own import adds no duplicates');

  const seven = Array.from({ length: 7 }, (_, index) => ({ id: `fixed-${index}`, bizNo: String(1000000000 + index), name: `검증업체 ${index}` }));
  const first = createBoard([], Array.from({ length: 5 }, emptyRow));
  first.board.loadCompanies = async () => seven;
  first.flush();
  await first.result.importCompanies(); first.flush();
  assert.equal(first.board.groupAssignments.length, 7);
  assert.equal(first.board.groupAssignments.every((row) => row[0] === null), true, 'never fill leader position');
  assert.deepEqual(first.board.groupAssignments.map((row) => row[1]), seven.map((item) => `region-${item.id}`));
  assert.equal(first.result.loading, false);
  await first.result.importCompanies(); first.flush();
  assert.equal(first.board.candidates.length, 7);
  assert.equal(first.board.groupAssignments.length, 7, 'repeated imports add no duplicates or rows');
  assert.match(first.notices.at(-1).message, /이미 배치/);

  const existing = { ...seven[0], id: 'existing', manualScore: 7 };
  const second = createBoard([existing], [emptyRow()]);
  second.board.loadCompanies = async () => [seven[0]];
  second.flush(); await second.result.importCompanies(); second.flush();
  assert.equal(second.board.candidates.length, 1);
  assert.equal(second.board.candidates[0].manualScore, 7);
  assert.equal(second.board.groupAssignments[0][1], 'region-existing', 'reuse existing participant ID');

  const originalRows = [['rep-existing', 'region-existing', null, null, null], emptyRow()];
  const third = createBoard([existing], originalRows);
  third.board.loadCompanies = async () => [seven[0], seven[1]];
  third.flush(); await third.result.importCompanies(); third.flush();
  assert.deepEqual(third.board.groupAssignments[0], originalRows[0], 'leave occupied rows intact');
  assert.equal(third.board.groupAssignments[1][1], 'region-fixed-1');

  let resolve;
  third.board.loadCompanies = () => new Promise((done) => { resolve = done; });
  third.flush();
  let pending = third.result.importCompanies();
  third.board.context = { ...third.board.context, fileType: 'sobang' };
  third.flush(); resolve(seven); await pending; third.flush();
  assert.equal(third.board.candidates.length, 2, 'ignore results after notice changes');
  assert.equal(third.result.loading, false);
  assert.match(third.notices.at(-1).message, /공고정보가 변경/);

  pending = third.result.importCompanies();
  third.board.open = false;
  third.flush(); resolve(seven); await pending; third.flush();
  assert.equal(third.board.candidates.length, 2, 'ignore results after closing');
  assert.equal(third.result.loading, false);

  first.board.loadCompanies = async () => { throw new Error('서버 연결 실패'); };
  first.flush(); await first.result.importCompanies(); first.flush();
  assert.equal(first.result.loading, false);
  assert.match(first.notices.at(-1).message, /서버 연결 실패/);
  const history = createBoard([], [emptyRow()], true);
  history.board.loadCompanies = async () => seven.slice(0, 2);
  history.flush(); await history.result.importCompanies(); history.flush();
  assert.equal(history.undo.count, 1);
  assert.equal(history.board.groupAssignments.length, 2);
  await history.result.importCompanies(); history.flush();
  assert.equal(history.undo.count, 1, 'no history entry for duplicate-only imports');
  history.board.loadCompanies = async () => seven.slice(2, 3);
  history.flush(); await history.result.importCompanies(); history.flush();
  assert.equal(history.undo.count, 2);
  history.undo.undo(); history.flush();
  assert.equal(history.undo.count, 1);
  assert.equal(history.board.candidates.length, 2);
  assert.equal(history.board.groupAssignments.length, 2);
  history.undo.undo(); history.flush();
  assert.equal(history.undo.count, 0);
  assert.equal(history.board.candidates.length, 0);
  assert.deepEqual(history.board.groupAssignments, [emptyRow()]);
  await history.result.importCompanies(); history.flush();
  assert.equal(history.undo.count, 1);
  history.board.resetKey = 'loaded-another-board'; history.flush();
  assert.equal(history.undo.count, 0, 'clear history across board contexts');
  console.log('PASS: undo history integration, multiple imports reversed in order, restored candidates/rows, no duplicate history, board-context reset');
  console.log('PASS: own corporations always in leader slots (including local companies), fixed local/member and nonlocal/leader roles, region aliases, multiple duty regions, shared board import, 7 companies / 5 rows, member-only placement, duplicates, existing data and ID preservation, occupied rows, stale results, close cancellation, errors');
})().catch((error) => { console.error(error); process.exitCode = 1; });
