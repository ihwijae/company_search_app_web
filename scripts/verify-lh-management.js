// Synthetic data only: management detail, mixed methods and PDF layout.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { evaluateScores } = require('../src/shared/evaluator');
const formulasDoc = require('../src/shared/formulas.defaults.json');
const industryAverages = require('../src/shared/industryAverages.json');
const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);

async function main() {
  const { createDocumentForm } = await load('src/view/features/document-generation/documentForm.js');
  const { resolveLhApplication } = await load('src/shared/agreements/lhApplication.js');
  const { resolveDocumentExperience } = await load('src/shared/agreements/documentEvaluation.js');
  const { resolveLhOverview } = await load('src/shared/agreements/lhOverview.js');
  const { createLhApplicationPdf } = await load('src/shared/documents/lhApplicationPdf.js');
  const { createLhSubmissionPdf } = await load('src/shared/documents/lhOverviewPdf.js');
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const options = { evaluateScores, formulasDoc, industryAverages };
  const fonts = { regularFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Regular.ttf')), boldFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Bold.ttf')) };
  let cases = 0;
  for (const industry of ['eung', 'tongsin', 'sobang']) for (const count of [2, 3, 4, 5]) {
    const form = createDocumentForm();
    Object.assign(form, { ownerId: 'LH', rangeId: 'lh-50to100', industry, companyCount: count, noticeDate: '2026-11-20', noticeNo: 'MANAGEMENT-001', noticeTitle: '경영상태 검증용 공사', bidDeadline: '2026-11-25T10:00', baseAmount: '9,556,620,000', bidAmount: '9,293,373,771', expectedPrice: '10,520,624,000', aValue: '704,658,655' });
    for (let index = 0; index < count; index++) Object.assign(form.companies[index], {
      name: `검증업체${index + 1}(주)`, representative: '검증 대표', address: '서울 검증주소', share: String(index === count - 1 ? 100 - Math.floor(100 / count) * (count - 1) : Math.floor(100 / count)),
      performance5y: '10,000,000,000', creditGradeText: index % 2 ? 'A- (25.01.01~25.12.31)' : 'A- (26.01.01~26.12.31)',
      debtRatio: index % 2 ? '18.13' : '', currentRatio: index % 2 ? '1733' : '', bizYears: index % 2 ? '2010.01.01' : '',
    });
    const application = resolveLhApplication(form, options);
    const experience = resolveDocumentExperience(form, options);
    const overview = resolveLhOverview(form, { application, experience });
    const model = overview.model.managementPage;
    assert.equal(model.companies[0].method, 'credit');
    assert.equal(model.companies[1].method, 'composite');
    assert.equal(model.companies[1].expired, true);
    assert.equal(model.totalScore, overview.model.scores.management);
    assert.equal(model.missing.length, 0);
    assert.equal(model.financialSubtotal + model.creditSubtotal, 15);
    assert.equal(model.industryAvg.debtRatio, industryAverages[industry].debtRatio);
    const oldApplication = structuredClone(application);
    oldApplication.model.methods.forEach((company) => { delete company.detailsVersion; delete company.financialDetails; delete company.creditDetails; });
    const enriched = resolveLhApplication(form, { ...options, previousSnapshot: oldApplication });
    assert.deepEqual(enriched.model.methods.map((company) => [company.method, company.score]), oldApplication.model.methods.map((company) => [company.method, company.score]));
    if (industry === 'eung') {
      const applicationBytes = await createLhApplicationPdf(application.model, fonts);
      const bytes = await createLhSubmissionPdf(applicationBytes, overview.model, { ...fonts, allowIncomplete: true });
      const pdf = await getDocument({ data: bytes.slice() }).promise;
      assert.equal(pdf.numPages, 10);
      const financial = await (await pdf.getPage(5)).getTextContent();
      const credit = await (await pdf.getPage(6)).getTextContent();
      const financialText = financial.items.map((item) => item.str).join('').replace(/\s/g, '');
      const creditText = credit.items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.ok(financialText.includes('3.경영상태평가'));
      assert.ok(!financialText.includes('나.회사채'));
      assert.ok(creditText.includes('나.회사채,기업어음,기업의신용평가등급으로평가하는경우'));
      const creditTitle = credit.items.find((item) => item.str.startsWith('나. 회사채'));
      const creditHeader = credit.items.find((item) => item.str === '회사채에 대한');
      assert.ok(creditTitle.transform[5] > creditHeader.transform[5]);
      assert.ok(financialText.includes('18.13%/120.77%'));
      assert.ok(financialText.includes('A:22점'));
      assert.ok(creditText.includes('(A-)'));
      assert.ok(creditText.includes('총합계'));
      assert.ok(!financialText.includes('환산'));
      assert.ok(!creditText.includes('환산'));
      const left = (595.28 - 520) / 2;
      const financialStart = left + 267;
      const financialWidth = 253 / count;
      assert.ok(financial.items.filter((item) => item.str === '-' && item.transform[4] >= financialStart && item.transform[4] < financialStart + financialWidth).length >= 3, 'Credit companies must have dashes in financial rows');
      const creditStart = left + 338;
      const creditWidth = 182 / count;
      assert.ok(credit.items.filter((item) => item.str === '-' && item.transform[4] >= creditStart + creditWidth && item.transform[4] < creditStart + creditWidth * 2).length >= 10, 'Financial companies must have dashes in credit rows');
      assert.ok([...financial.items, ...credit.items].every((item) => item.transform[5] >= 55));
      if (count === 3 || count === 5) await fs.writeFile(`/tmp/lh-management-${count}-preview.pdf`, bytes);
      await pdf.destroy();
      if (count === 3) {
        const sample = structuredClone(form);
        const names = ['신신이앤씨(주)', '㈜대도종합건설', '㈜영화전력'];
        sample.companies.slice(0, 3).forEach((company, index) => Object.assign(company, {
          name: names[index], share: String([61, 25, 14][index]),
          managementMethod: index === 2 ? 'composite' : 'credit',
          creditGradeText: `${index === 1 ? 'BB+' : 'A-'} (26.01.01~26.12.31)`,
          debtRatio: '18.13', currentRatio: '1733', bizYears: '2021.02.22',
        }));
        const application = resolveLhApplication(sample, options);
        const experience = resolveDocumentExperience(sample, options);
        const overview = resolveLhOverview(sample, { application, experience });
        const bytes = await createLhSubmissionPdf(await createLhApplicationPdf(application.model, fonts), overview.model, { ...fonts, allowIncomplete: true });
        const pdf = await getDocument({ data: bytes.slice() }).promise;
        const financialText = (await (await pdf.getPage(5)).getTextContent()).items.map((item) => item.str).join('').replace(/\s/g, '');
        const creditText = (await (await pdf.getPage(6)).getTextContent()).items.map((item) => item.str).join('').replace(/\s/g, '');
        assert.ok(financialText.includes('㈜영화전력:22+21+2=45점'));
        assert.ok(financialText.includes('(45*15/45*14%)=2.1'));
        assert.ok(creditText.includes('신신이앤씨(주):A-(35점)'));
        assert.ok(creditText.includes('㈜대도종합건설:BB+(35점)'));
        assert.ok(creditText.includes('(35*15/35*86%)=12.9'));
        assert.equal(overview.model.scores.management, 15);
        await fs.writeFile('/tmp/lh-management-formula-preview.pdf', bytes);
        await pdf.destroy();
      }
    }
    cases++;
  }
  console.log(`PASS: ${cases} management cases, common scores, missing/expired credit fallback, non-applicable dashes, historical detail enrichment and ten-page PDF`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
