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

function createBoard(companies, rows) {
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
  const board = {
    context: { ownerId: 'MOIS', menuKey: 'mois-30to50', fileType: 'eung', dutyRegions: ['서울'] },
    open: true, candidates: companies, excluded: [], groupAssignments: rows, safeGroupSize: 5,
    buildRegionSearchPayload: () => board.context,
    loadCompanies: async () => [], validateImport: () => '', title: '업체 불러오기 검증',
    notify: (notice) => notices.push(notice), portalContainer: null,
    setGroupAssignments: (next) => { board.groupAssignments = next; dirty = true; },
    onUpdateBoard: (next) => { Object.assign(board, next); updateParticipants(); dirty = true; },
  };
  function updateParticipants() {
    board.participantMap = new Map(board.candidates.map((candidate) => [`region-${candidate.id}`, { uid: `region-${candidate.id}`, candidate }]));
  }
  updateParticipants();
  function flush() {
    for (let pass = 0; pass < 20; pass += 1) {
      cursor = 0; effects = []; dirty = false;
      result = hook(board);
      effects.forEach((effect) => effect());
      if (!dirty) return result;
    }
    throw new Error('Import hook did not settle');
  }
  return { board, notices, flush, get result() { return result; } };
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
  console.log('PASS: fixed local/member and nonlocal/leader roles, region aliases, multiple duty regions, shared board import, 7 companies / 5 rows, member-only placement, duplicates, existing data and ID preservation, occupied rows, stale results, close cancellation, errors');
})().catch((error) => { console.error(error); process.exitCode = 1; });
