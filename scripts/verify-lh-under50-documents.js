// Synthetic records only. Run: node scripts/verify-lh-under50-documents.js
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { evaluateScores } = require('../src/shared/evaluator');
const formulasDoc = require('../src/shared/formulas.defaults.json');
const industryAverages = require('../src/shared/industryAverages.json');
const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lh-under50-documents-'));
  process.env.COMPANY_SEARCH_APP_DATA_ROOT = root;
  try {
    const { createDocumentForm } = await load('src/view/features/document-generation/documentForm.js');
    const { resolveDocumentExperience } = await load('src/shared/agreements/documentEvaluation.js');
    const { resolveLhApplication } = await load('src/shared/agreements/lhApplication.js');
    const { buildLhCredibilityPage } = await load('src/shared/agreements/lhCredibility.js');
    const { resolveLhOverview } = await load('src/shared/agreements/lhOverview.js');
    const { evaluateLhBidPrice, LH_UNDER50_BID_PRICE_RULES } = await load('src/shared/agreements/calculations/lhBidPrice.js');
    const { createLhApplicationPdf } = await load('src/shared/documents/lhApplicationPdf.js');
    const { createLhSubmissionPdf } = await load('src/shared/documents/lhOverviewPdf.js');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const store = require('../api/_lib/document-generation-store');
    const options = { formulasDoc, industryAverages, evaluateScores };
    const form = createDocumentForm();
    Object.assign(form, {
      ownerId: 'LH', rangeId: 'lh-under50', companyCount: 1, noticeNo: 'UNDER50-TEST', noticeTitle: '50억 미만 검증 공사',
      noticeDate: '2026-11-20', bidDeadline: '2026-11-30T10:00', writtenDate: '2026-11-26',
      estimatedPrice: '2,500,000,000', baseAmount: '2,750,000,000',
      bidAmount: '2,462,500,000', expectedPrice: '2,800,000,000', aValue: '100,000,000',
    });
    form.companies.forEach((company, index) => Object.assign(company, {
      name: `단독검증업체${index + 1}`, representative: '검증대표', address: '검증 주소',
      performance5y: '3,000,000,000', qualityScore: index % 2 ? '88' : '85', share: '100',
      debtRatio: '10', currentRatio: '1000', bizYears: '2010.01.01',
      creditGradeText: 'BB-', creditExpiry: '2027-12-31', managementMethod: index % 2 ? 'credit' : 'composite',
    }));
    const resolve = (sample, previousSnapshot = null) => resolveLhOverview(sample, {
      application: resolveLhApplication(sample, options), experience: resolveDocumentExperience(sample, { formulasDoc }), previousSnapshot,
    });
    const price = (bidAmount, expectedPrice = '1000000', aValue = '0') => evaluateLhBidPrice({ bidAmount, expectedPrice, aValue }, LH_UNDER50_BID_PRICE_RULES);
    assert.equal(price('900000').score, 70);
    assert.equal(price('875000').score, 60);
    assert.equal(price('925000').score, 60);
    assert.equal(price('887500').score, 65);
    assert.equal(price('875051').score, 60.04);
    assert.equal(price('').score, null);
    assert.equal(price('900000', '1000000', '').score, null);
    assert.equal(price('900000', '1000000', '1000000').score, null);
    let cases = 0;
    for (const industry of ['eung', 'tongsin', 'sobang']) for (const count of [1, 2, 3, 4, 5]) {
      const sample = structuredClone(form);
      Object.assign(sample, { industry, companyCount: count });
      sample.companies.slice(0, count).forEach((company, index) => { company.share = String(index === count - 1 ? 100 - 100 / count * (count - 1) : 100 / count); });
      const overview = resolve(sample);
      assert.equal(overview.model.complete, true);
      assert.equal(overview.model.scores.bid, 60);
      assert.equal(overview.model.scores.subcontract, null);
      assert.equal(overview.model.scores.material, null);
      assert.equal(overview.model.scores.subtotal, Math.round((overview.model.scores.management + overview.model.scores.construction) * 100) / 100);
      assert.equal(overview.model.scores.total, Math.round((overview.model.scores.subtotal + 60) * 100) / 100);
      assert.equal(overview.model.experiencePage.result.denominator, 2750000000);
      assert.equal(overview.model.experiencePage.criteria.qualityAggregation, 'weighted-raw');
      assert.equal(overview.model.managementPage.financialFormScale, 1);
      for (const company of overview.model.managementPage.companies) {
        const board = evaluateScores({ agencyId: 'lh', amount: 2500000000, inputs: { fileType: industry, debtRatio: 10, currentRatio: 1000, bizYears: 16, creditGrade: 'BB-' }, formulasDoc, industryAvg: industryAverages[industry] });
        assert.equal(company.score, board.management[company.method].score);
      }
      if (count === 2) {
        assert.equal(overview.model.experiencePage.result.qualityTotal, 86.5);
        assert.equal(overview.model.experiencePage.result.qualityPoints, 2);
      }
      cases++;
    }
    assert.equal(resolve(form).model.scores.total, 90);
    const expired = structuredClone(form);
    Object.assign(expired.companies[0], { managementMethod: 'auto', creditExpiry: '2020-01-01' });
    assert.equal(resolve(expired).model.managementPage.companies[0].method, 'composite');
    for (const patch of [{ bidAmount: '' }, { expectedPrice: '' }, { aValue: '' }]) {
      const incomplete = resolve({ ...form, ...patch });
      assert.equal(incomplete.model.complete, false);
      assert.equal(incomplete.model.scores.total, null);
    }
    const badShares = structuredClone(form);
    badShares.companies[0].share = '90';
    assert.equal(resolve(badShares).model.scores.total, null);

    const saved = await store.saveDocument({ title: '50억 미만 서류 검증', form });
    const restored = await store.loadDocument(saved.id);
    assert.deepEqual(restored.form, form);
    assert.deepEqual(restored.overviewSnapshot, saved.overviewSnapshot);
    assert.deepEqual(resolve(form, restored.overviewSnapshot), restored.overviewSnapshot);
    const copied = await store.saveDocument({ title: '50억 미만 사본', sourceId: saved.id, sourceRevision: saved.revision, form });
    assert.deepEqual(copied.overviewSnapshot, saved.overviewSnapshot);
    const originalMax = LH_UNDER50_BID_PRICE_RULES.maxScore;
    try {
      LH_UNDER50_BID_PRICE_RULES.maxScore = 69;
      assert.equal(resolve(form).model.scores.bid, 59);
      assert.deepEqual(resolve(form, saved.overviewSnapshot), saved.overviewSnapshot);
      const changedTitle = resolve({ ...form, noticeTitle: '공고명 수정 검증' }, saved.overviewSnapshot);
      assert.equal(changedTitle.model.scores.bid, 60);
    } finally { LH_UNDER50_BID_PRICE_RULES.maxScore = originalMax; }
    const upperRange = resolve({ ...form, rangeId: 'lh-50to100' }, saved.overviewSnapshot);
    assert.equal(upperRange.criteria.bidPrice.maxScore, 50);
    assert.equal(upperRange.model.scores.bid, 45);
    assert.equal(upperRange.model.scores.subcontract, 10);
    const legacy = structuredClone(saved.overviewSnapshot);
    legacy.model.credibilityPage = buildLhCredibilityPage(legacy.model.members);
    const upgraded = resolve(form, legacy);
    assert.equal(upgraded.model.credibilityPage.templateId, 'lh-under50-v2');
    assert.deepEqual(upgraded.model.scores, legacy.model.scores);
    assert.deepEqual(upgraded.criteria, legacy.criteria);
    assert.equal(legacy.model.credibilityPage.items.length, 14);
    assert.deepEqual(upgraded.model.credibilityPage.items.map((item) => item.id), ['employment', 'deleted']);
    const updated = await store.saveDocument({ id: saved.id, revision: saved.revision, title: saved.title, form });
    assert.equal(updated.overviewSnapshot.model.credibilityPage.templateId, 'lh-under50-v2');
    const fonts = {
      regularFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Regular.ttf')),
      boldFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Bold.ttf')),
    };
    const applicationBytes = await createLhApplicationPdf(restored.applicationSnapshot.model, fonts);
    const bytes = await createLhSubmissionPdf(applicationBytes, restored.overviewSnapshot.model, fonts);
    await fs.writeFile('/tmp/lh-under50-submission-preview.pdf', bytes);
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    assert.equal(pdf.numPages, 8);
    for (let page = 1; page <= pdf.numPages; page++) {
      const items = (await (await pdf.getPage(page)).getTextContent()).items;
      const text = items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.ok(!text.includes('NaN'));
      assert.ok(!text.includes('단독검증업체2'));
      assert.ok(!text.includes('5.하도급관리계획적정성평가'));
      assert.ok(!text.includes('6.자재및인력조달가격의적정성평가'));
      if (page === 2) {
        assert.ok(!text.includes('하도급'));
        assert.ok(!text.includes('자재'));
        assert.ok(text.includes('90점'));
        assert.ok(text.includes('60점'));
      }
      if (page === 4) {
        assert.ok(text.includes('(공사예정금액×1)'));
        assert.ok(text.includes('88점이상(3점)'));
        assert.ok(!text.includes('90점이상(5점)'));
      }
      if (page === 5) assert.ok(!text.includes('나.회사채'));
      if (page === 6) assert.ok(text.includes('나.회사채,기업어음,기업의신용평가등급으로평가하는경우'));
      if (page === 7) {
        for (const fragment of ['4.신인도평가', '일자리창출', '퇴직급여액제외', '<삭제>', '합계[최종평점:신인도평점합계]', '배점범위:+1.5', '+1.0', '+0.5']) assert.ok(text.includes(fragment), fragment);
        for (const fragment of ['성실성', '하도급관련사항', '건설재해', '합산벌점', '-3']) assert.ok(!text.includes(fragment), fragment);
        assert.ok(items.every((item) => item.transform[5] >= 55));
      }
      if (page === 8) {
        for (const fragment of ['5.입찰가격점수', '=70-4×', '2,462,500,000-100,000,000', '2,800,000,000-100,000,000', '0.8750', '60.00점']) assert.ok(text.includes(fragment), fragment);
      }
    }
    await pdf.destroy();
    const fiveCompanies = structuredClone(form);
    fiveCompanies.companyCount = 5;
    fiveCompanies.companies.forEach((company) => { company.share = '20'; });
    const fiveApplication = resolveLhApplication(fiveCompanies, options);
    const fiveApplicationBytes = await createLhApplicationPdf(fiveApplication.model, fonts);
    const fiveBytes = await createLhSubmissionPdf(fiveApplicationBytes, resolve(fiveCompanies).model, fonts);
    const fivePdf = await getDocument({ data: fiveBytes.slice() }).promise;
    assert.equal(fivePdf.numPages, 8);
    for (const page of [3, 4, 5, 6, 7]) {
      const text = (await (await fivePdf.getPage(page)).getTextContent()).items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.ok(text.includes('단독검증업체5'));
    }
    await fivePdf.destroy();
    console.log(`PASS: ${cases} LH under-50 range/industry/member cases, bid formula, shared management, weighted-raw quality, incomplete inputs, saved copies and eight-page PDF`);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
