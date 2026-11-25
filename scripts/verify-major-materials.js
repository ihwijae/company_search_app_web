// Run with: node scripts/verify-major-materials.js
// All settings are written to a fresh temporary data root.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Readable } = require('node:stream');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'major-materials-check-'));
  process.env.COMPANY_SEARCH_APP_DATA_ROOT = root;
  try {
    const { createMajorMaterials, normalizeMajorMaterialItems } = await import(pathToFileURL(path.join(__dirname, '../src/shared/majorMaterials.js')).href);
    const store = require('../api/_lib/major-materials-store');
    const handler = require('../api/major-materials');
    const initial = await store.loadMajorMaterials();
    assert.equal(initial.revision, 0);
    assert.equal(initial.items.switches.length, 4);
    assert.equal(initial.items.outlets.length, 4);
    const changed = createMajorMaterials();
    changed.items.switches[0].companyName = '검증용 스위치 업체';
    changed.items.switches[0].address = '검증용 주소\n상세주소 101호';
    assert.equal(changed.items.outlets[0].companyName, initial.items.outlets[0].companyName);
    assert.notEqual(changed.items.switches[0], changed.items.outlets[0]);
    const saved = await store.saveMajorMaterials({ revision: 0, items: changed.items });
    assert.equal(saved.revision, 1);
    assert.deepEqual((await store.loadMajorMaterials()).items, changed.items);
    const file = JSON.parse(await fs.readFile(path.join(root, 'config/major-materials.json'), 'utf8'));
    assert.deepEqual(file, saved);
    delete require.cache[require.resolve('../api/_lib/major-materials-store')];
    assert.deepEqual(await require('../api/_lib/major-materials-store').loadMajorMaterials(), saved);
    await assert.rejects(store.saveMajorMaterials({ revision: 0, items: initial.items }), { status: 409 });
    assert.deepEqual(await store.loadMajorMaterials(), saved);

    const nextItems = structuredClone(saved.items);
    nextItems.outlets[3].address = '수정된 콘센트 업체주소';
    const concurrent = await Promise.allSettled([
      store.saveMajorMaterials({ revision: 1, items: nextItems }),
      store.saveMajorMaterials({ revision: 1, items: initial.items }),
    ]);
    assert.equal(concurrent[0].status, 'fulfilled');
    assert.equal(concurrent[1].reason.status, 409);
    const current = await store.loadMajorMaterials();
    assert.equal(current.revision, 2);
    assert.equal(current.items.outlets[3].address, '수정된 콘센트 업체주소');
    assert.equal(current.items.switches[0].address, '검증용 주소\n상세주소 101호');
    assert.throws(() => normalizeMajorMaterialItems({ switches: null, outlets: [] }));
    const invalid = structuredClone(current.items);
    invalid.switches[1].address = { unsupported: true };
    await assert.rejects(store.saveMajorMaterials({ revision: 2, items: invalid }), { status: 400 });
    await assert.rejects(store.saveMajorMaterials(null), { status: 400 });
    await assert.rejects(store.saveMajorMaterials({ revision: '2', items: current.items }), { status: 400 });
    assert.deepEqual(await store.loadMajorMaterials(), current);

    async function call(method, body) {
      const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
      req.method = method;
      const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.payload = JSON.parse(value); } };
      await handler(req, res);
      return res;
    }
    const response = await call('GET');
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.payload.data.items, current.items);
    assert.equal((await call('POST', '{')).statusCode, 400);
    assert.equal((await call('POST', 'null')).statusCode, 400);
    assert.equal((await call('POST', { revision: 0, items: initial.items })).statusCode, 409);
    assert.equal((await call('DELETE')).statusCode, 405);
    const post = await call('POST', { revision: 2, items: nextItems });
    assert.equal(post.statusCode, 200);
    assert.equal(post.payload.data.revision, 3);

    const reduced = structuredClone(nextItems);
    const removedName = reduced.switches[1].companyName;
    reduced.switches.splice(1, 1);
    const reducedResponse = await call('POST', { revision: 3, items: reduced });
    assert.equal(reducedResponse.statusCode, 200);
    assert.equal(reducedResponse.payload.data.items.switches.length, 3);
    assert.equal(reducedResponse.payload.data.items.outlets.length, 4);
    const reducedLoad = await store.loadMajorMaterials();
    assert.deepEqual(reducedLoad.items, reduced);
    assert.equal(reducedLoad.items.switches.some((supplier) => supplier.companyName === removedName), false);
    assert.equal(reducedLoad.items.switches[1].companyName, nextItems.switches[2].companyName);
    const reducedFile = JSON.parse(await fs.readFile(path.join(root, 'config/major-materials.json'), 'utf8'));
    assert.equal(reducedFile.items.switches.length, 3, 'Deleted suppliers must not return as blank fourth rows');
    reduced.outlets.pop();
    const bothReduced = await store.saveMajorMaterials({ revision: 4, items: reduced });
    assert.equal(bothReduced.items.outlets.length, 3);
    reduced.switches.push({ companyName: '추가한 업체', address: '새 주소' });
    const restored = await store.saveMajorMaterials({ revision: 5, items: reduced });
    assert.equal(restored.items.switches.length, 4);
    assert.equal(restored.items.outlets.length, 3);
    const tooMany = structuredClone(restored.items);
    tooMany.switches.push({ companyName: '초과 업체', address: '' });
    await assert.rejects(store.saveMajorMaterials({ revision: 6, items: tooMany }), { status: 400 });
    assert.equal((await store.loadMajorMaterials()).revision, 6);
    console.log('PASS: template defaults, category independence, persistence, conflicts, deletion 4→3 without padding, supplier restoration and API validation');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
