// Run with: node scripts/verify-lh-document-evaluation.js
// Synthetic data only; never reads or writes application data.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const formulasDoc = require('../src/shared/formulas.defaults.json');
const load = (name) => import(pathToFileURL(path.join(__dirname, '..', name)).href);

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lh-document-check-'));
  process.env.COMPANY_SEARCH_APP_DATA_ROOT = root;
  try {
    const rules = await load('src/shared/agreements/calculations/lhQualification.js');
    assert.equal(rules.parseLhEvaluationNumber('9'.repeat(1000)), null);
    const { resolveDocumentExperience } = await load('src/shared/agreements/documentEvaluation.js');
    const { buildGroupSummaryMetrics, computeGroupSummaries } = await load('src/shared/agreements/calculations/groupSummary.js');
    const { createDocumentForm, normalizeDocumentForm, companyFromSearch } = await load('src/view/features/document-generation/documentForm.js');
    const { getDocumentRangeOptions } = await load('src/shared/navigation.js');
    const store = require('../api/_lib/document-generation-store');
    const form = createDocumentForm();
    Object.assign(form, { ownerId: 'LH', rangeId: 'lh-50to100', baseAmount: '9,556,620,000', estimatedPrice: '8,687,836,364' });
    Object.assign(form.companies[0], { name: '검증 대표사', share: '51', performance5y: '10,000,000,000', qualityScore: '' });
    Object.assign(form.companies[1], { name: '검증 구성사', share: '49', performance5y: '5,000,000,000', qualityScore: '88' });
    assert.deepEqual(getDocumentRangeOptions('LH').map((range) => range.key), ['lh-under50', 'lh-50to100']);
    assert.deepEqual(getDocumentRangeOptions('LH', 'comprehensive').map((range) => range.key), ['lh-100to300']);
    assert.equal(getDocumentRangeOptions('MOIS').length, 3);
    assert.equal(normalizeDocumentForm({ ...form, ownerId: 'PPS' }).rangeId, '');
    assert.equal(normalizeDocumentForm({ ...form, reviewType: 'comprehensive' }).rangeId, '');
    const mapped = companyFromSearch({ name: '조회 업체', '5년 실적': '123,000', '품질평가': '93.38 (25.05.01)' });
    assert.equal(mapped.performance5y, '123,000');
    assert.equal(mapped.qualityScore, '93.38 (25.05.01)');

    let cases = 0;
    for (const rangeId of ['lh-under50', 'lh-50to100']) for (const industry of ['eung', 'tongsin', 'sobang']) {
      const criteria = rules.resolveLhQualificationCriteria({ rangeId, fileType: industry, formulasDoc });
      const multiplier = rangeId === 'lh-under50' ? 1 : industry === 'sobang' ? 3 : 2;
      assert.equal(criteria.denominatorMultiplier, multiplier);
      for (const quality of [0, 79.99, 80, 82.99, 83, 84.99, 85, 87.99, 88, 89.99, 90, 95]) {
        const expectedQuality = rangeId === 'lh-50to100' && quality >= 90 ? 5 : quality >= 88 ? 3 : quality >= 85 ? 2 : quality >= 83 ? 1.5 : quality >= 80 ? 1 : 0;
        assert.equal(rules.resolveLhQualificationQualityPoints(quality, criteria), expectedQuality);
      }
      for (const ratio of [0, .0049, .005, .1049, .1051, .4999, .9951, 1, 1.5, 5.4444]) {
        const sample = structuredClone(form);
        Object.assign(sample, { rangeId, industry, baseAmount: '1,000,000,000' });
        sample.companies[0].performance5y = String(1000000000 * multiplier * ratio);
        sample.companies[1].performance5y = sample.companies[0].performance5y;
        const snapshot = resolveDocumentExperience(sample, { formulasDoc });
        const result = snapshot.result;
        const participants = new Map(sample.companies.slice(0, 2).map((company, index) => [String(index), { candidate: company }]));
        const metrics = buildGroupSummaryMetrics({
          groupAssignments: [['0', '1']], participantMap: participants,
          getSharePercent: (group, slot, candidate) => Number(candidate.share),
          getCandidateManagementScore: () => 15,
          getCandidatePerformanceAmountForCurrentRange: (candidate) => Number(candidate.performance5y),
          getCandidateSipyungAmount: () => 0,
        });
        const denominator = 1000000000 * multiplier;
        const identity = (value) => value;
        const round = (value) => value == null ? null : Math.round(value * 100) / 100;
        const summaries = await computeGroupSummaries({
          metrics, performanceBaseReady: true, perfBase: 1000000000,
          evaluatePerformanceScore: async (amount) => ({ score: 0, ratioRounded: Number((amount / denominator).toFixed(2)) }),
          managementMax: 15, managementScoreMax: 15, getPerformanceCap: () => 13, derivedPerformanceMax: 13,
          clampScore: (value, cap) => value == null ? null : Math.min(Math.max(value, 0), cap),
          roundForMoisManagement: identity, roundForLhTotals: round, roundUpForPpsUnder50: identity,
          roundForKrailUnder50: identity, roundForExManagement: identity, roundForPerformanceTotals: identity,
          isLhUnder50: rangeId === 'lh-under50', isLh50To100: rangeId === 'lh-50to100',
        });
        const legacyRaw = Number((metrics[0].performanceAmount / denominator).toFixed(2)) * 13;
        assert.equal(result.performanceScore, round(Math.min(Math.max(legacyRaw, 0), 13)));
        assert.equal(result.performanceScore, summaries[0].performanceScore);
        assert.equal(result.performanceRawScore, summaries[0].performanceScoreRaw);
        assert.equal(result.score, Math.min(result.performanceScore + result.qualityPoints, 15));
        cases++;
      }
    }
    const incomplete = structuredClone(form);
    incomplete.companies[0].performance5y = '';
    assert.equal(resolveDocumentExperience(incomplete, { formulasDoc }).result.status, 'incomplete');
    const zero = structuredClone(form);
    zero.companies[0].performance5y = '0';
    assert.equal(resolveDocumentExperience(zero, { formulasDoc }).result.status, 'complete');
    assert.equal(resolveDocumentExperience({ ...form, rangeId: '' }, { formulasDoc }), null);

    const revised = structuredClone(form);
    revised.companies[0].qualityScore = '93.38';
    revised.companies[1].qualityScore = '92.52';
    const revisedResult = resolveDocumentExperience(revised, { formulasDoc });
    assert.equal(revisedResult.result.qualityPoints, 5);
    assert.deepEqual(revisedResult.result.members.map((member) => [member.qualityGrade, member.qualityPoints]), [['A', 5], ['A', 5]]);
    revised.companies[1].qualityScore = '85';
    assert.equal(resolveDocumentExperience(revised, { formulasDoc }).result.qualityPoints, 3);
    const { buildAgreementExportPayload } = await load('src/shared/agreements/agreementExportPayload.js');
    const candidateMap = new Map(revised.companies.slice(0, 2).map((candidate, index) => [String(index), { candidate }]));
    const exported = buildAgreementExportPayload({
      ownerId: 'LH', isLHOwner: true, selectedRangeKey: 'lh-50to100', groupAssignments: [['0', '1']],
      participantMap: candidateMap, summaryByGroup: new Map([[0, {}]]),
      parseNumeric: rules.parseLhEvaluationNumber,
      getSharePercent: (group, slot, company) => Number(company.share),
      getCandidateManagementScore: () => 15, getCandidatePerformanceAmountForCurrentRange: () => 0,
      getCandidateSipyungAmount: () => 0, isDutyRegionCompany: () => false,
      sanitizeCompanyName: (value) => value, getCompanyName: (company) => company.name,
      getCandidateManagerName: () => '', getRegionLabel: () => '', normalizeBizNo: (value) => value, getBizNo: () => '',
      getQualityScoreValue: (group, slot, company) => Number(company.qualityScore),
      resolveQualityPoints: () => { throw new Error('Export must use the shared weighted raw-score evaluator'); },
    });
    assert.equal(exported.groups[0].summary.qualityPoints, 3);
    const oldCriteria = structuredClone(revisedResult.criteria);
    oldCriteria.qualityAggregation = 'weighted-grade';
    const legacyResult = rules.evaluateLhQualificationExperience({
      ...revisedResult.inputs,
      companies: revisedResult.inputs.companies.map((company, index) => ({ ...company, qualityScore: index === 0 ? 93.38 : 85 })),
      criteria: oldCriteria,
    });
    assert.equal(legacyResult.qualityPoints, 3.53, 'Reproduce the incorrect grade-first saved result');
    const legacySnapshot = { ...revisedResult, criteria: oldCriteria, inputs: { ...revisedResult.inputs, companies: legacyResult.members.map(({ qualityApplied: _a, qualityDefaulted: _d, qualityGrade: _g, qualityPoints: _p, ...company }) => company) }, result: legacyResult };
    assert.equal(resolveDocumentExperience(revised, { formulasDoc, previousSnapshot: legacySnapshot }).result.qualityPoints, 3, 'Opening a grade-first document must restore weighted raw-score grading');
    const upgraded = resolveDocumentExperience(revised, { formulasDoc, previousSnapshot: legacySnapshot });
    assert.equal(upgraded.result.qualityPoints, 3);
    assert.equal(upgraded.criteria.denominatorMultiplier, legacySnapshot.criteria.denominatorMultiplier);
    assert.equal(upgraded.criteria.performanceMultiplier, legacySnapshot.criteria.performanceMultiplier);
    const oldDocument = await store.saveDocument({ title: '개정 전 검증용', form: revised });
    oldDocument.evaluationSnapshot = legacySnapshot;
    oldDocument.overviewSnapshot = null;
    await fs.writeFile(path.join(root, 'document-generation', `${oldDocument.id}.json`), JSON.stringify(oldDocument));
    const revisedCopy = await store.saveDocument({ title: '품질 개정 사본', sourceId: oldDocument.id, sourceRevision: 1, form: revised });
    assert.equal(revisedCopy.evaluationSnapshot.result.qualityPoints, 3);
    assert.equal(revisedCopy.overviewSnapshot.model.experiencePage.criteria.qualityAggregation, 'weighted-raw');
    assert.equal((await store.loadDocument(oldDocument.id)).evaluationSnapshot.result.qualityPoints, 3.53, 'Preview and copy must not rewrite the source file');
    const revisedSave = await store.saveDocument({ title: '품질 개정 저장', id: oldDocument.id, revision: 1, form: revised });
    assert.equal(revisedSave.evaluationSnapshot.result.qualityPoints, 3);
    assert.equal((await store.loadDocument(oldDocument.id)).evaluationSnapshot.criteria.qualityAggregation, 'weighted-raw');
    assert.equal((await store.saveDocument({ title: '개정 유지', id: oldDocument.id, revision: 2, form: revised })).evaluationSnapshot.result.qualityPoints, 3);
    revised.companies[0].share = '50'; revised.companies[1].share = '50';
    assert.equal(resolveDocumentExperience(revised, { formulasDoc, previousSnapshot: legacySnapshot }).result.qualityPoints, 3);
    assert.equal(resolveDocumentExperience({ ...revised, rangeId: 'lh-under50' }, { formulasDoc }).result.qualityPoints, 3, 'Keep LH under-50 weighted raw-score grading');

    const originalRawCriteria = { ...legacySnapshot.criteria };
    delete originalRawCriteria.qualityAggregation;
    const originalRaw = { ...upgraded, criteria: originalRawCriteria };
    assert.strictEqual(resolveDocumentExperience({ ...revised, companies: revised.companies.map((company, index) => ({ ...company, share: index === 0 ? '51' : '49' })) }, { formulasDoc, previousSnapshot: originalRaw }), originalRaw, 'Unchanged original raw-score snapshots remain pinned');

    const rawCriteria = rules.resolveLhQualificationCriteria({ rangeId: 'lh-50to100', fileType: 'eung', formulasDoc });
    for (const [scores, expectedTotal, expectedPoints] of [
      [[90, 80], 85, 2], [[90, 86], 88, 3], [[95, 85], 90, 5],
      [[86, 80], 83, 1.5], [[85, 75], 80, 1], [[79, 79], 79, 0],
    ]) {
      const evaluated = rules.evaluateLhQualificationQuality(scores.map((qualityScore) => ({ qualityScore, share: 50 })), rawCriteria);
      assert.equal(evaluated.qualityTotal, expectedTotal);
      assert.equal(evaluated.qualityPoints, expectedPoints);
    }

    const original = await store.saveDocument({ title: '당시 제출', form });
    const snapshot = structuredClone(original.evaluationSnapshot);
    assert.equal(snapshot.result.status, 'complete');
    assert.equal(snapshot.criteria.denominatorMultiplier, 2);
    const config = rules.LH_QUALIFICATION_RULES;
    const prior = structuredClone(config);
    try {
      config.performanceMultiplier = 12;
      config.ranges['lh-50to100'].denominatorMultipliers.eung = 4;
      config.ranges['lh-50to100'].qualityThresholds[0].score = 6;
      const current = resolveDocumentExperience(form, { formulasDoc });
      assert.equal(current.criteria.denominatorMultiplier, 4);
      assert.notEqual(current.result.performanceScore, snapshot.result.performanceScore);
      assert.deepEqual(resolveDocumentExperience(form, { previousSnapshot: snapshot, formulasDoc }), snapshot);
      assert.deepEqual((await store.loadDocument(original.id)).evaluationSnapshot, snapshot);
      const resaved = await store.saveDocument({ id: original.id, revision: 1, title: '이름 수정', form });
      assert.deepEqual(resaved.evaluationSnapshot, snapshot);
      const copied = await store.saveDocument({ sourceId: original.id, sourceRevision: 2, title: '제출 사본', form });
      assert.deepEqual(copied.evaluationSnapshot, snapshot);
      const fresh = await store.saveDocument({ title: '신규 제출', form });
      assert.equal(fresh.evaluationSnapshot.criteria.denominatorMultiplier, 4);
      const changed = structuredClone(form);
      changed.companies[0].performance5y = '1';
      const recalculated = await store.saveDocument({ id: original.id, revision: 2, title: '실적 수정', form: changed });
      assert.equal(recalculated.evaluationSnapshot.criteria.denominatorMultiplier, 2);
      assert.equal(recalculated.evaluationSnapshot.criteria.performanceMultiplier, 13);
      assert.notDeepEqual(recalculated.evaluationSnapshot.result, snapshot.result);
      await assert.rejects(store.saveDocument({ sourceId: original.id, sourceRevision: 1, title: '오래된 원본', form }), { status: 409 });
      await assert.rejects(store.saveDocument({ title: '잘못된 구간', form: { ...form, rangeId: 'pps-under50' } }), { status: 400 });
    } finally {
      Object.assign(config, prior);
    }
    const legacy = structuredClone(original);
    delete legacy.form.rangeId;
    delete legacy.evaluationSnapshot;
    for (const company of legacy.form.companies) { delete company.performance5y; delete company.qualityScore; }
    await fs.writeFile(path.join(root, 'document-generation', `${legacy.id}.json`), JSON.stringify(legacy));
    const restoredLegacy = await store.loadDocument(legacy.id);
    assert.equal(restoredLegacy.form.rangeId, '');
    assert.equal(restoredLegacy.evaluationSnapshot, undefined);
    console.log(`PASS: ${cases} LH board parity cases, quality boundaries, scope/range selection, frozen historical results, pinned-rule recalculation, copies and legacy loading`);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
