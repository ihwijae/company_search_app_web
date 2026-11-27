// Run with: node scripts/verify-lh-overview.js (synthetic data and temporary storage).
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lh-overview-check-'));
  process.env.COMPANY_SEARCH_APP_DATA_ROOT = root;
  try {
    const { createDocumentForm } = await load('src/view/features/document-generation/documentForm.js');
    const { resolveLhApplication } = await load('src/shared/agreements/lhApplication.js');
    const { resolveDocumentExperience } = await load('src/shared/agreements/documentEvaluation.js');
    const { resolveLhOverview } = await load('src/shared/agreements/lhOverview.js');
    const { computeGroupSummaries, buildGroupSummaryMetrics } = await load('src/shared/agreements/calculations/groupSummary.js');
    const { LH_QUALIFICATION_RULES } = await load('src/shared/agreements/calculations/lhQualification.js');
    const { evaluateLhBidPrice, LH_BID_PRICE_RULES } = await load('src/shared/agreements/calculations/lhBidPrice.js');
    const { createLhApplicationPdf } = await load('src/shared/documents/lhApplicationPdf.js');
    const { createLhOverviewPdf, createLhSubmissionPdf } = await load('src/shared/documents/lhOverviewPdf.js');
    const store = require('../api/_lib/document-generation-store');
    const form = createDocumentForm();
    Object.assign(form, { ownerId: 'LH', rangeId: 'lh-50to100', noticeNo: 'OVERVIEW-001', noticeTitle: '검증용 총괄 전기공사', noticeDate: '2026-11-20', bidDeadline: '2026-11-25T10:00', baseAmount: '9,556,620,000', estimatedPrice: '8,687,836,364' });
    Object.assign(form, { bidAmount: '9,293,373,771', expectedPrice: '10,520,624,000', aValue: '704,658,655' });
    const options = { formulasDoc, industryAverages, evaluateScores };
    for (let index = 0; index < 5; index++) Object.assign(form.companies[index], {
      name: `검증업체${index + 1}(주)`, representative: `대표${index + 1}`, address: '서울특별시 검증로 100',
      share: '50', performance5y: '11,000,000,000', qualityScore: index % 2 ? '88' : '',
      sipyungAmount: '69,679,476,000', registrationNo: `서울-0042${index}`, rank: '2886 위 / 21,276 개',
      phone: '02-1234-5678', writer: `작성자${index + 1}`, bizNo: `123-45-0000${index}`, corporateNo: '110111-0699095',
      creditGradeText: index % 2 ? '' : 'BB- (26.01.01~26.12.31)', debtRatio: '150', currentRatio: '150', bizYears: '2010.01.01',
    });
    const resolve = (sample, previousSnapshot = null) => {
      const application = resolveLhApplication(sample, options);
      const experience = resolveDocumentExperience(sample, { formulasDoc });
      return resolveLhOverview(sample, { previousSnapshot, application, experience });
    };
    let cases = 0;
    for (const industry of ['eung', 'tongsin', 'sobang']) for (const count of [1, 2, 3, 4, 5]) {
      const sample = structuredClone(form);
      sample.industry = industry;
      sample.companyCount = count;
      sample.companies.slice(0, count).forEach((company, index) => { company.share = String(index === count - 1 ? 100 - 100 / count * (count - 1) : 100 / count); });
      const application = resolveLhApplication(sample, options);
      const experience = resolveDocumentExperience(sample, { formulasDoc });
      const overview = resolveLhOverview(sample, { application, experience });
      assert.equal(overview.model.calculatedReady, true);
      const ids = Array.from({ length: count }, (_, index) => String(index));
      const map = new Map(ids.map((id) => [id, { candidate: { share: Number(sample.companies[Number(id)].share), score: application.model.methods[Number(id)].score } }]));
      const metrics = buildGroupSummaryMetrics({ groupAssignments: [ids], participantMap: map, getSharePercent: (group, slot, candidate) => candidate.share, getCandidateManagementScore: (candidate) => candidate.score, getCandidatePerformanceAmountForCurrentRange: () => 1, getCandidateSipyungAmount: () => 0 });
      const identity = (value) => value;
      const round = (value) => value == null ? null : Math.round(value * 100) / 100;
      const [board] = await computeGroupSummaries({
        metrics, managementMax: 15, managementScoreMax: 15, clampScore: (value, cap = 15) => value == null ? null : Math.min(Math.max(value, 0), cap),
        roundForMoisManagement: identity, roundForLhTotals: round, roundForKrailUnder50: identity, roundForExManagement: identity, roundUpForPpsUnder50: identity, roundForPerformanceTotals: identity,
        getPerformanceCap: () => 13, derivedPerformanceMax: 13, isLh50To100: true,
      });
      assert.equal(overview.model.scores.management, board.managementScore);
      assert.equal(overview.model.scores.construction, experience.result.score);
      assert.equal(overview.model.scores.subcontract, 10);
      assert.equal(overview.model.scores.material, 10);
      assert.equal(overview.model.scores.bid, 45);
      assert.equal(overview.model.bidResult.ratioRounded, 0.875);
      assert.equal(overview.model.companyProfiles.length, count);
      assert.equal(overview.model.scores.credibility, 0);
      const expectedSubtotal = round(overview.model.scores.construction + overview.model.scores.management + 20);
      assert.equal(overview.model.scores.subtotal, expectedSubtotal);
      assert.equal(overview.model.scores.total, round(expectedSubtotal + 45));
      assert.equal(overview.model.complete, true);
      assert.ok(overview.model.credibilityPage.items.every((item) => item.scores.length === count && item.scores.every((score) => score === (item.scoreBlank ? '' : 0))));
      assert.ok(overview.model.credibilityPage.members.every((member) => member.score === 0));
      cases++;
    }
    const incomplete = structuredClone(form);
    incomplete.companies[0].share = '';
    assert.equal(resolve(incomplete).model.scores.management, null);
    assert.equal(resolve(incomplete).model.scores.construction, null);
    assert.equal(resolve({ ...form, rangeId: 'lh-under50' }).model.rangeId, 'lh-under50');
    assert.equal(resolve({ ...form, rangeId: 'lh-100to300' }), null, 'Unsupported ranges must not reuse qualification forms');
    const originalConstruction = resolve(form).model.scores.construction;
    assert.equal(resolve({ ...form, estimatedPrice: '1' }).model.scores.construction, originalConstruction, 'LH 50–100 follows the board base-amount denominator');
    assert.notEqual(resolve({ ...form, baseAmount: '19,113,240,000' }).model.scores.construction, originalConstruction);
    for (const key of ['bidAmount', 'expectedPrice', 'aValue']) {
      const missingPrice = resolve({ ...form, [key]: '' });
      assert.equal(missingPrice.model.scores.bid, null);
      assert.equal(missingPrice.model.calculatedReady, false);
    }
    assert.equal(evaluateLhBidPrice({ bidAmount: '900', expectedPrice: '1000', aValue: '0' }).score, 50);
    assert.equal(evaluateLhBidPrice({ bidAmount: '925', expectedPrice: '1000', aValue: '0' }).score, 45);
    assert.equal(evaluateLhBidPrice({ bidAmount: '875049', expectedPrice: '1000000', aValue: '0' }).score, 45);
    assert.equal(evaluateLhBidPrice({ bidAmount: '875051', expectedPrice: '1000000', aValue: '0' }).score, 45.02);
    for (const invalid of [
      { expectedPrice: form.aValue }, { expectedPrice: '1' }, { bidAmount: '1' }, { aValue: '-1' }, { bidAmount: '0' },
    ]) assert.equal(evaluateLhBidPrice({ ...form, ...invalid }).score, null);

    const fonts = { regularFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Regular.ttf')), boldFontBytes: await fs.readFile(path.join(__dirname, '../src/assets/fonts/Pretendard-Bold.ttf')) };
    const application = resolveLhApplication(form, options);
    const overview = resolve(form);
    const { evaluateLhQualificationExperience } = await load('src/shared/agreements/calculations/lhQualification.js');
    const rawExperience = resolveDocumentExperience(form, { formulasDoc });
    const gradeCriteria = { ...rawExperience.criteria, qualityAggregation: 'weighted-grade' };
    const gradeExperience = {
      ...rawExperience, criteria: gradeCriteria,
      result: evaluateLhQualificationExperience({ ...rawExperience.inputs, criteria: gradeCriteria }),
    };
    const gradeOverview = resolveLhOverview(form, { application, experience: gradeExperience });
    assert.equal(gradeOverview.model.experiencePage.result.qualityPoints, 2.5);
    const restoredRawExperience = resolveDocumentExperience(form, { formulasDoc, previousSnapshot: gradeExperience });
    const restoredOverview = resolveLhOverview(form, { application, experience: restoredRawExperience, previousSnapshot: gradeOverview });
    assert.equal(restoredOverview.model.experiencePage.result.qualityTotal, 86.5);
    assert.equal(restoredOverview.model.experiencePage.result.qualityPoints, 2);
    for (const key of ['construction', 'subtotal', 'total']) assert.equal(restoredOverview.model.scores[key], gradeOverview.model.scores[key] - .5);
    assert.deepEqual(restoredOverview.criteria.managementRules, gradeOverview.criteria.managementRules);
    assert.deepEqual(restoredOverview.criteria.bidPrice, gradeOverview.criteria.bidPrice);
    assert.equal(overview.model.credibilityPage.templateId, 'lh-50to100-v2');
    assert.deepEqual(overview.model.credibilityPage.items.map((item) => item.id), [
      'integrity', 'subcontract-orders', 'habitual-subcontract', 'accident-mortality', 'accident-prevention',
      'safety-expenses', 'accident-reports', 'safety-sanctions', 'environment', 'penalty-points',
      'employment', 'serious-accidents', 'safety-certification', 'deleted',
    ]);
    const oldCredibility = structuredClone(overview);
    delete oldCredibility.model.credibilityPage.templateId;
    oldCredibility.model.credibilityPage.items = oldCredibility.model.credibilityPage.items.slice(0, 4);
    const refreshedCredibility = resolve(form, oldCredibility);
    assert.deepEqual(refreshedCredibility.model.credibilityPage, overview.model.credibilityPage);
    assert.deepEqual(refreshedCredibility.model.scores, oldCredibility.model.scores);
    assert.deepEqual(refreshedCredibility.criteria, oldCredibility.criteria);
    assert.equal(oldCredibility.model.credibilityPage.items.length, 4);
    await assert.rejects(createLhOverviewPdf(resolve(incomplete).model, fonts), /미산정/);
    const appBytes = await createLhApplicationPdf(application.model, fonts);
    const bytes = await createLhSubmissionPdf(appBytes, overview.model, { ...fonts, allowIncomplete: true });
    await fs.writeFile('/tmp/lh-overview-preview.pdf', bytes);
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: bytes.slice() }).promise;
    assert.equal(pdf.numPages, 10);
    const firstText = (await (await pdf.getPage(1)).getTextContent()).items.map((item) => item.str).join('').replace(/\s/g, '');
    const secondText = (await (await pdf.getPage(2)).getTextContent()).items.map((item) => item.str).join('').replace(/\s/g, '');
    const fixedContent = (await (await pdf.getPage(9)).getTextContent()).items;
    const fixedText = fixedContent.map((item) => item.str).join('').replace(/\s/g, '');
    for (const value of ['5.하도급관리계획적정성평가', '하도급시행비율', '하도급금액비율', '10점', '6.자재및인력조달가격의적정성평가', '※자재및인력조달가격의적정성평가는배점한도점수를부여한다.']) assert.ok(fixedText.includes(value), value);
    assert.equal(fixedContent.filter((item) => item.str === '5' && item.transform[4] > 387 && item.transform[4] < 479).length, 2);
    const bidContent = (await (await pdf.getPage(10)).getTextContent()).items;
    const bidText = bidContent.map((item) => item.str).join('').replace(/\s/g, '');
    for (const value of ['7.입찰가격점수', '9,293,373,771-704,658,655', '10,520,624,000-704,658,655', '8,588,715,116', '9,815,965,345', '0.8750', '45.00점']) assert.ok(bidText.includes(value), value);
    const bidNumerator = bidContent.find((item) => item.str.trim() === '8,588,715,116');
    const bidDenominator = bidContent.find((item) => item.str.trim() === '9,815,965,345');
    assert.ok(bidNumerator.transform[5] > bidDenominator.transform[5]);
    assert.equal(overview.model.bidPricePage.score, overview.model.scores.bid);
    assert.match(firstText, /적격심사신청서/);
    assert.match(secondText, /적격심사자기평가및심사표/);
    assert.match(secondText, /OVERVIEW-001/);
    assert.match(secondText, /1\.총괄/);
    assert.ok(secondText.includes(`${overview.model.scores.total}점`));
    assert.match(secondText, /45점/);
    for (const pageNumber of [7, 8]) {
      const credibilityContent = await (await pdf.getPage(pageNumber)).getTextContent();
      const credibilityText = credibilityContent.items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.equal(credibilityText.includes('4.신인도평가'), pageNumber === 7);
      assert.ok(credibilityText.includes('검증업체1(주)'));
      assert.ok(credibilityContent.items.filter((item) => item.str === '0' && item.transform[4] > (595.28 - 520) / 2 + 403).length >= 8);
      assert.ok(credibilityContent.items.every((item) => item.transform[5] >= 55));
      assert.ok(!credibilityText.includes('(계속)'));
      assert.ok(!credibilityText.includes('신인도평가합계:0점'));
      const expected = pageNumber === 7
        ? ['사고사망만인율', '0.20배이하', '+3.0', '+2.4', '산업재해예방활동실적', '95점이상', '+2.0', '+1.6', '*<삭제>']
        : ['중대재해를발생시킨자', '사망자3명이상', '-3.5', '안전보건경영시스템인증', 'ISO-45001', 'KOSHA-MS', '<삭제>', '배점범위:+1.5~-3'];
      for (const fragment of expected) assert.ok(credibilityText.includes(fragment), fragment);
    }
    const profileText = (await (await pdf.getPage(3)).getTextContent()).items.map((item) => item.str).join('').replace(/\s/g, '');
    for (const value of ['다.업체현황', '검증업체1(주)', '검증업체2(주)', '69,679,476,000', '서울-00420', '2886위/21,276개', '작성자1', '110111-0699095']) assert.ok(profileText.includes(value), value);
    assert.ok(!profileText.includes('검증업체3(주)'));
    assert.equal(overview.model.scores.total, overview.model.scores.subtotal + overview.model.scores.bid);
    const experienceContent = await (await pdf.getPage(4)).getTextContent();
    const experienceText = experienceContent.items.map((item) => item.str).join('').replace(/\s/g, '');
    for (const value of ['2.시공경험평가', '검증업체1(주)', '11,000,000,000', '(9,556,620,000원×2)', '실적계수×13', '미평가적용', '85점', '88점', '(85*50%)+(88*50%)', '=86.5', 'C:85점이상(2)']) assert.ok(experienceText.includes(value), value);
    const symbolicNumerator = experienceContent.items.find((item) => item.str === '실적합계액');
    const symbolicDenominator = experienceContent.items.find((item) => item.str.replace(/\s/g, '') === '(공사예정금액×2)');
    const numericNumerator = experienceContent.items.find((item) => item.str === '11,000,000,000원');
    const numericDenominator = experienceContent.items.find((item) => item.str.replace(/\s/g, '') === '(9,556,620,000원×2)');
    for (const [numerator, denominator] of [[symbolicNumerator, symbolicDenominator], [numericNumerator, numericDenominator]]) {
      assert.ok(numerator && denominator);
      assert.ok(numerator.transform[5] > denominator.transform[5], 'Fractions must stack the numerator above the denominator');
      assert.ok(Math.abs(numerator.transform[4] + numerator.width / 2 - denominator.transform[4] - denominator.width / 2) < 1, 'Fraction terms must share a center');
    }
    assert.ok(!experienceText.includes('/'), 'Use stacked fractions rather than slash notation');
    assert.ok(!experienceText.includes('협정보드기준'), 'Keep implementation notes out of the submitted form');
    assert.ok(!experienceText.includes('NaN'));
    await pdf.destroy();
    const solo = structuredClone(form);
    solo.companyCount = 1;
    solo.companies[0].share = '100';
    const soloSaved = await store.saveDocument({ title: '단독 제출 검증', form: solo });
    const soloLoaded = await store.loadDocument(soloSaved.id);
    assert.deepEqual(soloLoaded.form, solo);
    const soloSummary = (await store.listDocuments()).find((document) => document.id === soloSaved.id);
    assert.equal(soloSummary.companyCount, 1);
    assert.deepEqual(soloSummary.companyNames, ['검증업체1(주)']);
    assert.equal(soloLoaded.overviewSnapshot.model.complete, true);
    assert.equal(soloLoaded.overviewSnapshot.model.shareSum, 100);
    assert.equal(soloLoaded.applicationSnapshot.model.methods.length, 1);
    const soloApplicationBytes = await createLhApplicationPdf(soloLoaded.applicationSnapshot.model, fonts);
    const soloBytes = await createLhSubmissionPdf(soloApplicationBytes, soloLoaded.overviewSnapshot.model, fonts);
    const soloPdf = await getDocument({ data: soloBytes.slice() }).promise;
    assert.equal(soloPdf.numPages, 10);
    for (let page = 1; page <= soloPdf.numPages; page++) {
      const content = await (await soloPdf.getPage(page)).getTextContent();
      const text = content.items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.ok(!text.includes('NaN'));
      for (let company = 2; company <= 5; company++) assert.ok(!text.includes(`검증업체${company}(주)`));
      if (page === 3) assert.ok(text.includes('검증업체1(주)'));
    }
    await soloPdf.destroy();
    for (const count of [3, 4, 5]) {
      const sample = structuredClone(form);
      sample.companyCount = count;
      sample.companies[0].address = '서울특별시 송파구 송파대로 167, 에이동 516호';
      const profileBytes = await createLhOverviewPdf(resolve(sample).model, { ...fonts, allowIncomplete: true });
      const profilePdf = await getDocument({ data: profileBytes.slice() }).promise;
      assert.equal(profilePdf.numPages, 9);
      const profilePage = await profilePdf.getPage(2);
      const content = await profilePage.getTextContent();
      const profile = content.items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.ok(profile.includes(`검증업체${count}(주)`));
      assert.ok(profile.includes('516호'));
      assert.ok(content.items.every((item) => item.transform[5] >= 57));
      const detailContent = await (await profilePdf.getPage(3)).getTextContent();
      const detail = detailContent.items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.ok(detail.includes(`검증업체${count}(주)`));
      assert.ok(!detail.includes(`검증업체${count + 1}(주)`));
      assert.ok(detailContent.items.every((item) => item.transform[5] >= 57));
      await profilePdf.destroy();
    }
    for (const variant of ['missing', 'sobang', 'long-names', 'source-layout', 'raw-weighting']) {
      const sample = structuredClone(form);
      if (variant === 'missing') { sample.baseAmount = ''; sample.companies[0].performance5y = ''; }
      if (variant === 'sobang') sample.industry = 'sobang';
      if (variant === 'long-names') {
        sample.companyCount = 5;
        sample.companies.forEach((company, index) => {
          company.name = `한국전기정보통신소방건설${index + 1}(주)`;
          company.share = '20';
        });
      }
      if (variant === 'source-layout') {
        sample.companyCount = 3;
        sample.baseAmount = '10,536,731,000';
        [61, 25, 14].forEach((share, index) => {
          sample.companies[index].share = String(share);
          sample.companies[index].qualityScore = '';
          sample.companies[index].performance5y = String([159139033000, 18946028000, 2270660000][index]);
        });
      }
      if (variant === 'raw-weighting') {
        sample.companies[0].name = '(주)도화엔지니어링'; sample.companies[0].share = '51'; sample.companies[0].qualityScore = '93.38';
        sample.companies[1].name = '(주)개성건설'; sample.companies[1].share = '49'; sample.companies[1].qualityScore = '92.52';
      }
      const bytes = await createLhOverviewPdf(resolve(sample).model, { ...fonts, allowIncomplete: true });
      const detailPdf = await getDocument({ data: bytes.slice() }).promise;
      const page = await detailPdf.getPage(3);
      const content = await page.getTextContent();
      const text = content.items.map((item) => item.str).join('').replace(/\s/g, '');
      assert.ok(!text.includes('NaN'));
      if (variant === 'missing') { assert.ok(text.includes('작성중')); assert.ok(text.includes('—')); }
      if (variant === 'sobang') assert.ok(text.includes('(9,556,620,000원×3)'));
      if (variant === 'source-layout') {
        assert.ok(text.includes('85점적용'));
        assert.ok(text.includes('(85*61%)+(85*25%)+(85*14%)=85'));
        assert.ok(text.includes('102,129,209,530원'));
        assert.ok(text.includes('(10,536,731,000원×2)'));
        await fs.writeFile('/tmp/lh-experience-source-layout.pdf', bytes);
      }
      if (variant === 'raw-weighting') {
        assert.ok(text.includes('93.38점'));
        assert.ok(!text.includes('A등급5점'));
        assert.ok(text.includes('92.52점'));
        assert.ok(text.includes('(93.38*51%)+(92.52*49%)=92.9586'));
        assert.ok(text.includes('A:90점이상(5'));
        await fs.writeFile('/tmp/lh-quality-raw-preview.pdf', bytes);
      }
      if (variant === 'long-names') {
        assert.ok(text.includes('한국전기정보통신소방건설5(주)'));
        await fs.writeFile('/tmp/lh-experience-five-companies.pdf', bytes);
      }
      assert.ok(content.items.every((item) => item.transform[5] >= 57));
      await detailPdf.destroy();
    }

    const saved = await store.saveDocument({ title: '총괄 검증', form });
    const frozen = structuredClone(saved.overviewSnapshot);
    assert.equal((await store.loadDocument(saved.id)).overviewSnapshot.model.scores.credibility, 0);
    assert.equal((await store.loadDocument(saved.id)).overviewSnapshot.model.scores.total, frozen.model.scores.total);
    const fullScore = structuredClone(form);
    fullScore.companies.slice(0, fullScore.companyCount).forEach((company) => {
      company.performance5y = '100,000,000,000'; company.qualityScore = '';
      company.managementMethod = 'credit'; company.creditGradeText = 'A- (26.01.01~26.12.31)';
    });
    const completeScores = resolve(fullScore).model.scores;
    assert.equal(completeScores.subtotal, 50);
    assert.equal(completeScores.total, 95);
    const missingPrice = resolve({ ...fullScore, bidAmount: '' }).model.scores;
    assert.equal(missingPrice.subtotal, 50);
    assert.equal(missingPrice.total, null);
    const badShares = structuredClone(fullScore);
    badShares.companies[1].share = '40';
    assert.equal(resolve(badShares).model.scores.total, null);
    const oldOverview = structuredClone(frozen);
    delete oldOverview.model.experiencePage;
    const restoredExperience = resolveLhOverview(form, {
      previousSnapshot: oldOverview, application,
      experience: saved.evaluationSnapshot,
    });
    assert.deepEqual(restoredExperience.model.scores, frozen.model.scores);
    assert.deepEqual(restoredExperience.model.experiencePage.criteria, saved.evaluationSnapshot.criteria);
    assert.deepEqual(restoredExperience.model.experiencePage.result, saved.evaluationSnapshot.result);
    assert.equal((await store.loadDocument(saved.id)).form.companies[0].sipyungAmount, '69,679,476,000');
    const addressChanged = structuredClone(form);
    addressChanged.companies[0].address = '부산광역시 수정주소 123';
    const profileChanged = resolve(addressChanged, frozen);
    assert.equal(profileChanged.model.companyProfiles[0].address, '부산광역시 수정주소 123');
    assert.deepEqual(profileChanged.model.scores, frozen.model.scores);
    assert.equal((await store.loadDocument(saved.id)).overviewSnapshot.model.scores.bid, 45);
    const priceChanged = resolve({ ...form, bidAmount: '9,400,000,000' }, frozen);
    assert.notEqual(priceChanged.model.scores.bid, 45);
    const legacy = structuredClone(frozen);
    for (const key of ['bidAmount', 'expectedPrice', 'aValue']) delete legacy.inputs[key];
    delete legacy.criteria.bidPrice;
    delete legacy.model.bidResult;
    legacy.model.scores.bid = null;
    legacy.model.pending = ['신인도', '입찰가격'];
    delete legacy.model.credibilityPage;
    delete legacy.criteria.credibility;
    legacy.model.scores.credibility = null; legacy.model.scores.subtotal = null; legacy.model.scores.total = null;
    const emptyPrices = { ...form, bidAmount: '', expectedPrice: '', aValue: '' };
    const migrated = resolve(emptyPrices, legacy);
    assert.equal(migrated.model.scores.credibility, 0);
    assert.equal(migrated.model.scores.bid, null);
    assert.equal(migrated.model.scores.total, null);
    assert.equal(migrated.model.scores.construction, legacy.model.scores.construction);
    assert.deepEqual(migrated.model.pending, ['입찰가격']);
    assert.equal(resolve(form, legacy).model.scores.bid, 45);
    const oldMax = LH_BID_PRICE_RULES.maxScore;
    try {
      LH_BID_PRICE_RULES.maxScore = 49;
      assert.equal(resolve(form).model.scores.bid, 44);
      assert.deepEqual(resolve(form, frozen), frozen);
      assert.equal(resolve({ ...form, noticeTitle: '공사명 수정' }, frozen).model.scores.bid, 45);
    } finally { LH_BID_PRICE_RULES.maxScore = oldMax; }
    const fixed = LH_QUALIFICATION_RULES.ranges['lh-50to100'];
    const originalScore = fixed.subcontractScore;
    try {
      fixed.subcontractScore = 9;
      assert.equal(resolve(form).model.scores.subcontract, 9);
      assert.deepEqual(resolve(form, frozen), frozen);
      assert.deepEqual((await store.loadDocument(saved.id)).overviewSnapshot, frozen);
      const copied = await store.saveDocument({ title: '총괄 사본', sourceId: saved.id, sourceRevision: saved.revision, form });
      assert.deepEqual(copied.overviewSnapshot, frozen);
      const changed = structuredClone(form);
      changed.companies[0].share = '60'; changed.companies[1].share = '40';
      const updated = await store.saveDocument({ id: saved.id, revision: saved.revision, title: '지분 수정', form: changed });
      assert.equal(updated.overviewSnapshot.criteria.subcontractScore, 10);
      assert.equal(updated.overviewSnapshot.inputs.members[0].share, 60);
    } finally { fixed.subcontractScore = originalScore; }
    console.log(`PASS: ${cases} board-management parity cases, shared experience, bid score, company profiles, ordered ten-page Korean PDF with experience evaluation and historical overview/copy preservation`);
    console.log('Synthetic preview: /tmp/lh-overview-preview.pdf');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
