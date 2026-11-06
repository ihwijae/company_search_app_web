// Run with: node scripts/check-fixed-companies.cjs
// Uses a temporary data root; never reads or writes application data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { pathToFileURL } = require('node:url');

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fixed-companies-check-'));
process.env.COMPANY_SEARCH_APP_DATA_ROOT = testRoot;
const handler = require('../api/fixed-companies');
const store = require('../api/_lib/fixed-companies-store');

async function request(method, body) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  req.method = method;
  const res = {
    setHeader() {},
    end(value) { this.payload = JSON.parse(value); },
  };
  await handler(req, res);
  return { status: res.statusCode, ...res.payload };
}

(async () => {
  const shared = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/fixedCompanies.js')).href);
  const boardImport = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/agreements/fixedCompanyImport.js')).href);
  const navigation = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/navigation.js')).href);
  for (const menu of navigation.AGREEMENT_MENU_ITEMS) {
    const expected = menu.ownerId === 'MOIS' && ['mois-under30', 'mois-30to50'].includes(menu.key)
      ? 'under50' : menu.key.split('-').at(-1);
    assert.equal(boardImport.resolveFixedCompanyRange({ ownerId: menu.ownerId, menuKey: menu.key }), expected, menu.key);
  }
  assert.equal(boardImport.resolveFixedCompanyRange({ ownerId: 'MOIS', rangeId: 'mois-30to50' }), 'under50');
  assert.equal(boardImport.resolveFixedCompanyRange({ ownerId: 'LH', menuKey: 'unknown' }), null);
  const scope = { industry: 'eung', range: 'under50', region: '서울' };
  const company = { name: '검증용 업체', bizNo: '123-45-67890', note: '연락 후 사용\n담당자 확인', snapshot: { 대표지역: '서울', 시평: '100' } };
  assert.equal((await request('GET')).data.version, 1);
  assert.deepEqual((await store.loadFixedCompanies()).groups, {});
  assert.equal(shared.FIXED_COMPANY_REGIONS.length, 17);
  assert.equal(shared.getFixedCompanyScopeKey({ ...scope, region: '서울특별시' }), 'eung:under50:서울');
  assert.throws(() => shared.getFixedCompanyScopeKey({ ...scope, range: 'invalid' }));
  const saved = await request('POST', { scope, companies: [company, { ...company, bizNo: '1234567890' }], revision: 0 });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.group.companies.length, 1, 'deduplicate business numbers');
  assert.equal(saved.data.group.companies[0].note, company.note, 'preserve multiline notes');
  assert.equal(saved.data.group.companies[0].snapshot.시평, '100');
  const revisions = await Promise.all([
    request('POST', { scope: { ...scope, region: '경기' }, companies: [company], revision: 0 }),
    request('POST', { scope: { ...scope, industry: 'sobang', range: '100to300' }, companies: [company], revision: 0 }),
  ]);
  assert.ok(revisions.every((item) => item.success), 'concurrent saves to different scopes succeed');
  const groups = (await request('GET')).data.groups;
  assert.equal(Object.keys(groups).length, 3, 'scope saves preserve other groups');
  assert.equal(groups['eung:under50:서울'].companies[0].note, company.note);
  const context = { ownerId: 'MOIS', menuKey: 'mois-under30', fileType: 'eung', dutyRegions: ['서울특별시', '경기도', '서울'] };
  const selected = boardImport.selectFixedCompaniesForBoard({ groups }, context);
  assert.equal(selected.length, 1, 'merge multiple regions and deduplicate the same company');
  assert.equal(selected[0].snapshot.시평, '100', 'retain source company fields for common scoring');
  assert.equal(selected[0].region, '서울');
  assert.equal(boardImport.selectFixedCompaniesForBoard({ groups }, { ...context, menuKey: 'mois-30to50' }).length, 1);
  assert.equal(boardImport.selectFixedCompaniesForBoard({ groups }, { ...context, menuKey: 'mois-50to100' }).length, 0);
  assert.equal(boardImport.selectFixedCompaniesForBoard({ groups }, { ...context, fileType: 'tongsin' }).length, 0);
  assert.equal(boardImport.selectFixedCompaniesForBoard({ groups }, { ...context, dutyRegions: ['부산'] }).length, 0);
  assert.equal(boardImport.selectFixedCompaniesForBoard({ groups }, { ...context, ownerId: 'LH', menuKey: 'lh-100to300', fileType: 'sobang' }).length, 1);
  assert.throws(() => boardImport.resolveFixedCompanyImportScopes({ ...context, dutyRegions: [] }), /의무지역/);
  assert.throws(() => boardImport.resolveFixedCompanyImportScopes({ ...context, fileType: 'all' }), /공종/);
  assert.equal((await request('POST', { scope, companies: [], revision: 0 })).status, 409, 'reject stale writes');
  const deleted = await request('POST', { scope, companies: [], revision: 1 });
  assert.equal(deleted.data.group.companies.length, 0);
  assert.equal(Object.keys((await request('GET')).data.groups).length, 3);
  assert.equal((await request('POST', { scope: { ...scope, industry: 'invalid' }, companies: [] })).status, 400);
  assert.equal((await request('POST', { scope, companies: 'invalid' })).status, 400);
  assert.equal((await request('DELETE')).status, 405);
  assert.equal(fs.existsSync(path.join(testRoot, 'config', 'fixed-companies.json')), true);
  // Old files without ownCorporations load with an empty collection.
  assert.deepEqual((await request('GET')).data.ownCorporations, {});
  const ownImport = await import(pathToFileURL(path.resolve(__dirname, '../src/shared/agreements/ownCorporationImport.js')).href);
  const ownEung = await request('POST', { kind: 'own-corporations', industry: 'eung', companies: [company, company], revision: 0 });
  assert.equal(ownEung.status, 200);
  assert.equal(ownEung.data.key, 'eung');
  assert.equal(ownEung.data.group.companies.length, 1);
  assert.equal(ownEung.data.group.range, undefined);
  assert.equal(ownEung.data.group.region, undefined);
  assert.equal((await request('POST', { kind: 'own-corporations', industry: 'tongsin', companies: [{ ...company, name: '통신법인' }], revision: 0 })).status, 200);
  const parallel = await Promise.all([
    request('POST', { kind: 'own-corporations', industry: 'sobang', companies: [company], revision: 0 }),
    request('POST', { scope: { ...scope, region: '충북' }, companies: [company], revision: 0 }),
  ]);
  assert.ok(parallel.every((response) => response.success));
  const ownDoc = (await request('GET')).data;
  assert.equal(Object.keys(ownDoc.groups).length, 4, 'own saves preserve fixed company groups');
  assert.equal(Object.keys(ownDoc.ownCorporations).length, 3, 'fixed saves preserve all own corporation industries');
  assert.equal(ownDoc.ownCorporations.eung.companies[0].note, company.note);
  for (const industry of ['eung', 'tongsin', 'sobang']) {
    const ownCandidates = ownImport.selectOwnCorporationsForBoard(ownDoc, { fileType: industry });
    assert.equal(ownCandidates.length, 1, 'own import requires only industry');
    assert.equal(ownCandidates[0].snapshot.시평, '100');
    assert.equal(ownImport.selectOwnCorporationsForBoard(ownDoc, { fileType: industry, dutyRegions: ['부산'], menuKey: 'unknown' }).length, 1, 'region and amount do not filter own corporations');
  }
  assert.equal((await request('POST', { kind: 'own-corporations', industry: 'eung', companies: [], revision: 0 })).status, 409);
  assert.equal((await request('POST', { kind: 'own-corporations', industry: 'eung', companies: [], revision: 1 })).status, 200);
  assert.equal((await request('GET')).data.ownCorporations.tongsin.companies.length, 1);
  assert.equal((await request('POST', { kind: 'own-corporations', industry: 'invalid', companies: [] })).status, 400);
  assert.equal((await request('POST', { kind: 'invalid', scope, companies: [] })).status, 400);
  console.log('PASS: own corporation industry-only storage and import, fixed/own data preservation, concurrent writes, duplicates, revisions, deletion');
  console.log('PASS: all owner range mappings (including both MOIS ranges), multi-region board selection, industry/range/region isolation, fixed company API, 17 regions, scope isolation, persistence, notes, deduplication, concurrent saves, stale writes, deletion, validation');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(testRoot, { recursive: true, force: true });
});
