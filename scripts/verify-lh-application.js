// Run with: node scripts/verify-lh-application.js
// Synthetic application and isolated temporary storage only.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { evaluateScores } = require('../src/shared/evaluator');
const formulasDoc = require('../src/shared/formulas.defaults.json');
const industryAverages = require('../src/shared/industryAverages.json');
const load = (name) => import(pathToFileURL(path.join(__dirname, '..', name)).href);

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lh-application-check-'));
  process.env.COMPANY_SEARCH_APP_DATA_ROOT = root;
  try {
    const { resolveLhApplication } = await load('src/shared/agreements/lhApplication.js');
    const { isCreditScoreExpired } = await load('src/shared/agreements/calculations/creditEvaluation.js');
    const { createDocumentForm, companyFromSearch } = await load('src/view/features/document-generation/documentForm.js');
    const { createLhApplicationPdf } = await load('src/shared/documents/lhApplicationPdf.js');
    const { PDFDocument } = require('pdf-lib');
    const store = require('../api/_lib/document-generation-store');
    const options = { formulasDoc, industryAverages, evaluateScores };
    for (const candidate of [
      { creditGrade: 'A-', creditNoteText: '25.01.01~25.12.31' },
      { creditGrade: 'A-', creditExpiryDate: '2026.12.31' },
      { creditGrade: 'A-', snapshot: { 데이터상태: { 신용평가: '경과' } } },
      { creditGrade: 'A-', creditExpired: true },
      { creditGrade: 'A-', creditNote: '만료' },
    ]) {
      const mapped = companyFromSearch(candidate);
      for (const evaluationDate of ['2025-06-01', '2026-11-20', '2027-01-01']) {
        assert.equal(isCreditScoreExpired(mapped, { evaluationDate }), isCreditScoreExpired(candidate, { evaluationDate }), 'Preserve credit expiry evidence from all board data aliases');
      }
    }
    const form = createDocumentForm();
    Object.assign(form, { ownerId: 'LH', rangeId: 'lh-50to100', noticeNo: 'TEST-001', noticeTitle: '검증용 전기공사', noticeDate: '2026-11-20', writtenDate: '2026-11-24', bidDeadline: '2026-11-25T10:00' });
    for (let i = 0; i < 5; i++) Object.assign(form.companies[i], {
      name: `검증업체${i + 1}(주)`, representative: `대표${i + 1}`, address: '서울특별시 검증로 100, 301호',
      creditGradeText: 'A- (26.01.01~26.12.31)', debtRatio: '500', currentRatio: '100', bizYears: '2010.01.01',
    });
    form.companies[1].creditGradeText = 'A- (25.01.01~25.12.31)';
    const application = resolveLhApplication(form, options);
    assert.equal(application.model.complete, true);
    assert.equal(application.model.methods[0].method, 'credit');
    assert.equal(application.model.methods[1].method, 'composite');
    assert.equal(application.model.methods[1].expired, true);
    assert.match(application.model.paragraph, /검증업체1\(주\)에 대해서는 신용평가등급/);
    assert.match(application.model.paragraph, /검증업체2\(주\)에 대해서는 부채비율/);
    assert.equal(isCreditScoreExpired({ creditGradeText: 'A- (26.01.01~26.11.20)' }, { evaluationDate: '2026-11-20' }), false);
    assert.equal(isCreditScoreExpired({ creditGradeText: 'A- (26.01.01~26.11.19)' }, { evaluationDate: '2026-11-20' }), true);
    const stale = structuredClone(form);
    stale.companies[0].creditStatus = '경과';
    assert.equal(resolveLhApplication(stale, options).model.methods[0].method, 'composite');
    const tie = structuredClone(form);
    Object.assign(tie.companies[0], { debtRatio: '18.13', currentRatio: '1733', bizYears: '2010.01.01' });
    assert.equal(resolveLhApplication(tie, options).model.methods[0].method, 'composite', 'Match the board evaluator: composite wins a tie');
    const manualCredit = structuredClone(tie);
    manualCredit.companies[0].managementMethod = 'credit';
    manualCredit.companies[0].creditGradeText = 'BB- (26.01.01~26.12.31)';
    const creditSelected = resolveLhApplication(manualCredit, options);
    assert.equal(creditSelected.model.methods[0].method, 'credit');
    assert.equal(creditSelected.model.methods[0].score, creditSelected.model.methods[0].creditScore);
    assert.ok(creditSelected.model.methods[0].score < creditSelected.model.methods[0].financialScore);
    const manualFinancial = structuredClone(form);
    manualFinancial.companies[0].managementMethod = 'composite';
    const financialSelected = resolveLhApplication(manualFinancial, options);
    assert.equal(financialSelected.model.methods[0].method, 'composite');
    assert.equal(financialSelected.model.methods[0].score, financialSelected.model.methods[0].financialScore);
    assert.ok(financialSelected.model.methods[0].score < financialSelected.model.methods[0].creditScore);
    const manualExpired = structuredClone(manualCredit);
    manualExpired.companies[0].creditGradeText = 'A- (25.01.01~25.12.31)';
    const expiredSelected = resolveLhApplication(manualExpired, options);
    assert.equal(expiredSelected.model.methods[0].score, null);
    assert.equal(expiredSelected.model.methods[0].method, null);
    assert.match(expiredSelected.model.methods[0].validationMessage, /만료/);
    const manualMissing = structuredClone(manualFinancial);
    manualMissing.companies[0].debtRatio = '';
    assert.equal(resolveLhApplication(manualMissing, options).model.methods[0].method, null);
    const incomplete = structuredClone(form);
    Object.assign(incomplete.companies[0], { creditGradeText: '', debtRatio: '', currentRatio: '', bizYears: '' });
    assert.equal(resolveLhApplication(incomplete, options).model.complete, false);
    const fonts = {
      regularFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Regular.ttf')),
      boldFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Bold.ttf')),
    };
    await assert.rejects(createLhApplicationPdf(resolveLhApplication(incomplete, options).model, fonts));
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    for (const rangeId of ['lh-under50', 'lh-50to100']) for (let count = 2; count <= 5; count++) {
      const sample = { ...form, rangeId, companyCount: count };
      const generated = resolveLhApplication(sample, options);
      const bytes = await createLhApplicationPdf(generated.model, fonts);
      const pdf = await PDFDocument.load(bytes);
      assert.equal(pdf.getPageCount(), 1);
      assert.ok(Math.abs(pdf.getPages()[0].getSize().width - 595.28) < .01);
      const parsed = await getDocument({ data: bytes.slice() }).promise;
      const page = await parsed.getPage(1);
      const items = (await page.getTextContent()).items;
      const text = items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.match(text, /적격심사신청서/);
      assert.match(text, /TEST-001/);
      assert.match(text, /검증용전기공사/);
      assert.match(text, /한국토지주택공사사장귀하/);
      assert.ok(text.includes(`검증업체${count}(주)`));
      assert.ok(items.every((item) => item.transform[4] >= 56 && item.transform[4] + item.width <= 540), 'All text stays within page margins');
      if (count === 3) await fs.writeFile('/tmp/lh-application-preview.pdf', bytes);
      await parsed.destroy();
    }
    const saved = await store.saveDocument({ title: '신청서 검증', form });
    assert.deepEqual(saved.applicationSnapshot.model, application.model);
    const later = resolveLhApplication(form, { ...options, previousSnapshot: saved.applicationSnapshot, now: '2030-01-01T00:00:00Z', evaluateScores: () => { throw new Error('Historical content must not be recalculated'); } });
    assert.deepEqual(later, saved.applicationSnapshot);
    const changedAddress = structuredClone(form);
    changedAddress.companies[0].address = '변경된 주소 101호';
    const changedSignature = resolveLhApplication(changedAddress, { ...options, previousSnapshot: saved.applicationSnapshot, evaluateScores: () => { throw new Error('Address edits must preserve the saved management decision'); } });
    assert.equal(changedSignature.model.leader.address, '변경된 주소 101호');
    assert.deepEqual(changedSignature.model.methods, saved.applicationSnapshot.model.methods);
    const copied = await store.saveDocument({ title: '신청서 사본', sourceId: saved.id, sourceRevision: saved.revision, form });
    assert.deepEqual(copied.applicationSnapshot, saved.applicationSnapshot);
    const selectedCopy = await store.saveDocument({ title: '평가방법 지정 사본', sourceId: saved.id, sourceRevision: saved.revision, form: manualFinancial });
    assert.equal(selectedCopy.form.companies[0].managementMethod, 'composite');
    assert.equal((await store.loadDocument(selectedCopy.id)).applicationSnapshot.model.methods[0].method, 'composite');
    assert.match(selectedCopy.applicationSnapshot.model.paragraph, /부채비율/);
    const creditCopy = await store.saveDocument({ title: '신용평가 지정 사본', sourceId: saved.id, sourceRevision: saved.revision, form: manualCredit });
    assert.equal((await store.loadDocument(creditCopy.id)).form.companies[0].managementMethod, 'credit');
    assert.equal(creditCopy.overviewSnapshot.model.managementPage.companies[0].method, 'credit');
    assert.equal(creditCopy.overviewSnapshot.model.managementPage.companies[0].score, creditCopy.applicationSnapshot.model.methods[0].creditScore);
    const oldRules = structuredClone(formulasDoc);
    oldRules.agencies.find((agency) => agency.id === 'lh').tiers[1].rules.management.methods.find((method) => method.id === 'credit').gradeTable.forEach((row) => { row.score = 0; });
    assert.equal(resolveLhApplication(form, { ...options, formulasDoc: oldRules }).model.methods[0].method, 'composite');
    assert.deepEqual(resolveLhApplication(form, { ...options, formulasDoc: oldRules, previousSnapshot: saved.applicationSnapshot }).model.methods, application.model.methods);
    console.log('PASS: both LH qualification ranges, shared credit expiry, mixed methods, financial ties, missing inputs, 2–5 companies, Korean PDF text, A4 single page, margins, saved historical application and copy');
    console.log('Synthetic preview PDF: /tmp/lh-application-preview.pdf');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
