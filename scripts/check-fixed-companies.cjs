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
  assert.equal((await request('POST', { scope, companies: [], revision: 0 })).status, 409, 'reject stale writes');
  const deleted = await request('POST', { scope, companies: [], revision: 1 });
  assert.equal(deleted.data.group.companies.length, 0);
  assert.equal(Object.keys((await request('GET')).data.groups).length, 3);
  assert.equal((await request('POST', { scope: { ...scope, industry: 'invalid' }, companies: [] })).status, 400);
  assert.equal((await request('POST', { scope, companies: 'invalid' })).status, 400);
  assert.equal((await request('DELETE')).status, 405);
  assert.equal(fs.existsSync(path.join(testRoot, 'config', 'fixed-companies.json')), true);
  console.log('PASS: fixed company API, 17 regions, scope isolation, persistence, notes, deduplication, concurrent saves, stale writes, deletion, validation');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(testRoot, { recursive: true, force: true });
});
