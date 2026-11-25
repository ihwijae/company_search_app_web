// Synthetic data only. Run with node scripts/verify-document-typography.js.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'document-typography-'));
  process.env.COMPANY_SEARCH_APP_DATA_ROOT = root;
  try {
    const { createDocumentForm, normalizeDocumentForm } = await load('src/view/features/document-generation/documentForm.js');
    const { resolveLhApplication } = await load('src/shared/agreements/lhApplication.js');
    const { resolveDocumentExperience } = await load('src/shared/agreements/documentEvaluation.js');
    const { resolveLhOverview } = await load('src/shared/agreements/lhOverview.js');
    const { createLhApplicationPdf } = await load('src/shared/documents/lhApplicationPdf.js');
    const { createLhSubmissionPdf } = await load('src/shared/documents/lhOverviewPdf.js');
    const { DOCUMENT_FONTS } = await load('src/shared/documents/documentTypography.js');
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = require('@napi-rs/canvas');
    const store = require('../api/_lib/document-generation-store');
    const options = { formulasDoc: require('../src/shared/formulas.defaults.json'), industryAverages: require('../src/shared/industryAverages.json'), evaluateScores: require('../src/shared/evaluator').evaluateScores };
    const form = createDocumentForm();
    Object.assign(form, { ownerId: 'LH', rangeId: 'lh-50to100', noticeNo: 'FONT-001', noticeTitle: '글꼴 확인용 전기공사', noticeDate: '2026-11-20', bidDeadline: '2026-11-25T10:00', baseAmount: '9,556,620,000', estimatedPrice: '8,687,836,364', bidAmount: '9,293,373,771', expectedPrice: '10,520,624,000', aValue: '704,658,655' });
    form.companies.forEach((company, index) => Object.assign(company, { name: `검증전기정보통신${index + 1}(주)`, representative: '김대표', address: '서울특별시 송파구 송파대로 167, 에이동 516호', share: '50', performance5y: '11,000,000,000', qualityScore: '93.38', sipyungAmount: '69,679,476,000', debtRatio: '150', currentRatio: '150', bizYears: '2010.01.01', creditGradeText: 'BB-', creditExpiry: '2026-12-31' }));
    assert.equal(normalizeDocumentForm({ ...form, fontFamily: undefined }).fontFamily, 'pretendard');
    assert.equal(normalizeDocumentForm({ ...form, fontFamily: 'invalid' }).fontFamily, 'pretendard');
    await assert.rejects(store.saveDocument({ title: 'invalid font', form: { ...form, fontFamily: 'invalid' } }), /서류 글꼴/);
    const legacyForm = structuredClone(form);
    delete legacyForm.fontFamily;
    assert.equal((await store.saveDocument({ title: 'legacy font default', form: legacyForm })).form.fontFamily, 'pretendard');
    let referenceScores;
    let cases = 0;
    for (const { value } of DOCUMENT_FONTS) {
      const name = { pretendard: 'Pretendard', 'nanum-gothic': 'NanumGothic', 'nanum-myeongjo': 'NanumMyeongjo' }[value];
      const fonts = { subsetFonts: value === 'pretendard', regularFontBytes: await fs.readFile(path.join(__dirname, `../src/assets/fonts/${name}-Regular.ttf`)), boldFontBytes: await fs.readFile(path.join(__dirname, `../src/assets/fonts/${name}-Bold.ttf`)) };
      for (const count of [2, 3, 4, 5]) {
        const sample = { ...form, fontFamily: value, companyCount: count, companies: form.companies.map((company, index) => ({ ...company, share: String(index === count - 1 ? 100 - (count - 1) * (100 / count) : 100 / count) })) };
        const application = resolveLhApplication(sample, options);
        const experience = resolveDocumentExperience(sample, options);
        const overview = resolveLhOverview(sample, { application, experience });
        if (count === 2) {
          referenceScores ||= overview.model.scores;
          assert.deepEqual(overview.model.scores, referenceScores, 'Font selection must not change scores');
          const saved = await store.saveDocument({ title: value, form: sample });
          assert.equal((await store.loadDocument(saved.id)).form.fontFamily, value);
        }
        const bytes = await createLhSubmissionPdf(await createLhApplicationPdf(application.model, fonts), overview.model, fonts);
        const pdf = await getDocument({ data: bytes.slice() }).promise;
        assert.equal(pdf.numPages, 10);
        for (let number = 1; number <= 10; number++) {
          const page = await pdf.getPage(number);
          const items = (await page.getTextContent()).items.filter((item) => item.str.trim());
          assert.ok(items.every((item) => item.transform[4] >= 25 && item.transform[4] + item.width <= 572 && item.transform[5] >= 25), `${value}/${count}/${number}: text outside page margins`);
          if (number === 10) assert.ok(items.map((item) => item.str).join('').replace(/\s/g, '').includes('45.00점'));
          if (count === 2 || count === 5) {
            const viewport = page.getViewport({ scale: 1 });
            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            await fs.writeFile(`/tmp/document-${value}-${count}-${number}.png`, canvas.toBuffer('image/png'));
          }
        }
        await pdf.destroy();
        cases++;
        console.log(`PASS: ${value}, ${count} companies, 10 pages`);
      }
    }
    console.log(`PASS: ${cases} PDF variants, page margins, saved font selection and unchanged scores`);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
