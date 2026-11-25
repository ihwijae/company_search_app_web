// Run with: node scripts/verify-document-generation.js
// Uses synthetic records in a fresh temporary data root.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'document-generation-check-'));
  process.env.COMPANY_SEARCH_APP_DATA_ROOT = root;
  try {
    const store = require('../api/_lib/document-generation-store');
    const handler = require('../api/document-generation');
    const company = () => ({
      name: '', bizNo: '', representative: '', share: '', rank: '', address: '', phone: '', writer: '',
      corporateNo: '', creditAgency: '', registrationNo: '', safetyDeductions: '', safetyCertificate: '',
      performance5y: '', qualityScore: '', sipyungAmount: '69,679,476,000',
      creditGradeText: '', creditExpiry: '', creditExpired: '', creditStatus: '', debtRatio: '', currentRatio: '', bizYears: '', managementMethod: 'auto',
    });
    const form = {
      reviewType: 'qualification', industry: 'eung', companyCount: 2, ownerId: 'LH', rangeId: '',
      estimatedPrice: '1,000,000,000', baseAmount: '1,100,000,000', noticeNo: 'TEST-2026-001', noticeTitle: '검증용 공고',
      bidAmount: '9,293,373,771', expectedPrice: '10,520,624,000', aValue: '704,658,655',
      noticeDate: '2026-11-20', writtenDate: '2026-11-24', bidDeadline: '2026-11-25T10:00',
      companies: Array.from({ length: 5 }, company),
    };
    Object.assign(form.companies[0], { name: '검증용 대표사', bizNo: '123-45-67890', representative: '대표자', share: '51', rank: '2886 위 / 21,276 개', address: '검증용 주소', phone: '02-000-0000', writer: '작성자', corporateNo: '000000-0000000', creditAgency: '㈜나이스디앤비', registrationNo: '등록-001', safetyDeductions: '없음', safetyCertificate: 'yes' });
    Object.assign(form.companies[1], { name: '검증용 구성사', share: '49', safetyCertificate: 'no' });
    form.companies[4].name = '숨겨진 카드 정보';
    assert.deepEqual(await store.listDocuments(), []);
    const saved = await store.saveDocument({ title: '최초 제출', form });
    assert.equal(saved.revision, 1);
    assert.deepEqual((await store.loadDocument(saved.id)).form, form);
    const listed = await store.listDocuments();
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0].companyNames, ['검증용 대표사', '검증용 구성사']);
    assert.equal(listed[0].form, undefined);

    const storePath = require.resolve('../api/_lib/document-generation-store');
    const persisted = JSON.parse(execFileSync(process.execPath, ['-e', 'require(process.argv[1]).loadDocument(process.argv[2]).then((doc) => process.stdout.write(JSON.stringify(doc)))', storePath, saved.id], { encoding: 'utf8', env: process.env }));
    assert.deepEqual(persisted.form, form, 'A fresh process must restore every saved field');

    const modified = structuredClone(form);
    modified.companies[0].address = '수정된 주소';
    const copy = await store.saveDocument({ title: '수정 제출 사본', form: modified });
    assert.notEqual(copy.id, saved.id);
    assert.equal((await store.loadDocument(saved.id)).form.companies[0].address, '검증용 주소');

    const results = await Promise.allSettled([
      store.saveDocument({ id: saved.id, revision: 1, title: '수정 제출', form: modified }),
      store.saveDocument({ id: saved.id, revision: 1, title: '오래된 화면', form }),
    ]);
    assert.equal(results[0].status, 'fulfilled');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[1].reason.status, 409);
    const updated = await store.loadDocument(saved.id);
    assert.equal(updated.revision, 2);
    assert.equal(updated.createdAt, saved.createdAt);
    assert.equal(updated.form.companies[0].address, '수정된 주소');
    assert.equal(updated.form.companies[0].rank, '2886 위 / 21,276 개');

    await assert.rejects(store.loadDocument('../../config'), { status: 400 });
    await assert.rejects(store.loadDocument('00000000-0000-4000-8000-000000000000'), { status: 404 });
    await assert.rejects(store.saveDocument({ title: '', form }), { status: 400 });
    await assert.rejects(store.saveDocument({ id: '', title: '잘못된 ID', form }), { status: 400 });
    await assert.rejects(store.saveDocument({ title: '잘못된 양식', form: { ...form, companies: [] } }), { status: 400 });
    await assert.rejects(store.saveDocument({ title: '잘못된 공종', form: { ...form, industry: 'invalid' } }), { status: 400 });
    const invalidMethod = structuredClone(form);
    invalidMethod.companies[0].managementMethod = 'unknown';
    await assert.rejects(store.saveDocument({ title: '잘못된 평가방법', form: invalidMethod }), { status: 400 });
    assert.equal((await store.listDocuments()).length, 2);

    async function call(method, url, body) {
      const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
      req.method = method;
      req.url = url;
      const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.payload = JSON.parse(value); } };
      await handler(req, response);
      return response;
    }
    const listResponse = await call('GET', '/api/document-generation');
    assert.equal(listResponse.statusCode, 200);
    assert.equal(listResponse.payload.data.length, 2);
    const loadResponse = await call('GET', `/api/document-generation?id=${saved.id}`);
    assert.deepEqual(loadResponse.payload.data.form, modified);
    assert.equal((await call('POST', '/api/document-generation', '{')).statusCode, 400);
    assert.equal((await call('POST', '/api/document-generation', 'null')).statusCode, 400);
    assert.equal((await call('PUT', '/api/document-generation')).statusCode, 405);
    const conflict = await call('POST', '/api/document-generation', { id: saved.id, revision: 1, title: '충돌', form });
    assert.equal(conflict.statusCode, 409);
    assert.equal((await call('DELETE', '/api/document-generation', null)).statusCode, 400);
    assert.equal((await call('DELETE', '/api/document-generation', { id: '../../config', revision: 1 })).statusCode, 400);
    assert.equal((await call('DELETE', '/api/document-generation', { id: saved.id })).statusCode, 400);
    assert.equal((await call('DELETE', '/api/document-generation', { id: saved.id, revision: 1 })).statusCode, 409);
    assert.equal((await store.loadDocument(saved.id)).revision, 2);
    const deletion = await call('DELETE', '/api/document-generation', { id: saved.id, revision: 2 });
    assert.equal(deletion.statusCode, 200);
    assert.equal(deletion.payload.data.id, saved.id);
    assert.equal((await call('GET', `/api/document-generation?id=${saved.id}`)).statusCode, 404);
    assert.equal((await call('GET', '/api/document-generation')).payload.data.length, 1);
    assert.deepEqual((await store.loadDocument(copy.id)).form, modified, 'Deletion must not affect another document');
    assert.equal((await call('DELETE', '/api/document-generation', { id: saved.id, revision: 2 })).statusCode, 404);
    const queued = await store.saveDocument({ title: '삭제 경합 검증', form });
    const race = await Promise.allSettled([
      store.saveDocument({ id: queued.id, revision: 1, title: '동시 수정', form }),
      store.deleteDocument({ id: queued.id, revision: 1 }),
    ]);
    assert.equal(race[0].status, 'fulfilled');
    assert.equal(race[1].reason.status, 409);
    assert.equal((await store.loadDocument(queued.id)).revision, 2);
    console.log('PASS: full-field round trip, process restart, copy preservation, revision conflicts, deletion API, stale-delete protection and save/delete serialization');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
