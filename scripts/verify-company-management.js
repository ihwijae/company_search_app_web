// Run with: node scripts/verify-company-management.js
// Uses synthetic company search payloads only.
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { evaluateScores } = require('../src/shared/evaluator');
const formulasDoc = require('../src/shared/formulas.defaults.json');
const industryAverages = require('../src/shared/industryAverages.json');
const load = (file) => import(pathToFileURL(path.join(__dirname, '..', file)).href);

async function main() {
  const { companyFromSearch, managementFieldsFromSearch, createDocumentForm } = await load('src/view/features/document-generation/documentForm.js');
  const { fetchCompanyManagement } = await load('src/view/features/document-generation/services/refreshCompanyManagement.js');
  const { resolveLhApplication } = await load('src/shared/agreements/lhApplication.js');
  const { resolveCandidateBusinessYears } = await load('src/shared/agreements/calculations/businessYears.js');
  const { parseLhEvaluationNumber } = await load('src/shared/agreements/calculations/lhQualification.js');
  const raw = { '검색된 회사': '검증업체', 사업자번호: '123-45-67890', 부채비율: 18.13, 유동비율: 1733, 영업기간: 43831, 신용평가: '' };
  const selected = companyFromSearch({ name: raw['검색된 회사'], bizNo: raw.사업자번호, snapshot: raw });
  assert.equal(selected.bizYears, '2020-01-01');
  assert.equal(selected.debtRatio, '18.13');
  assert.equal(selected.currentRatio, '1733');
  assert.equal(selected.creditGradeText, '');
  for (const value of [new Date(2020, 0, 1), 'Wed Jan 01 2020 00:00:00 GMT+0900 (Korean Standard Time)', { text: '2020.01.01' }, { result: '2020.01.01' }]) {
    assert.equal(managementFieldsFromSearch({ 영업기간: value }).bizYears, '2020-01-01');
  }
  assert.equal(managementFieldsFromSearch({ debt_ratio: 0, current_ratio: 0, biz_years: 5 }).debtRatio, '0');
  const original = { ...selected, representative: '수기 대표자', address: '수기 주소', share: '51', rank: '2886 위 / 21,276 개' };
  const fields = await fetchCompanyManagement(original, 'eung', { searchCompanies: async (criteria, industry, options) => {
    assert.equal(criteria.name, original.name);
    assert.equal(industry, 'eung');
    assert.equal(options.forceWebSearch, true);
    return { success: true, data: [{ ...raw, 사업자번호: '000-00-00000', 부채비율: 999 }, raw] };
  } });
  const refreshed = { ...original, ...fields };
  assert.equal(refreshed.representative, original.representative);
  assert.equal(refreshed.address, original.address);
  assert.equal(refreshed.share, original.share);
  assert.equal(refreshed.rank, original.rank);
  assert.equal(refreshed.debtRatio, '18.13');
  await assert.rejects(fetchCompanyManagement(original, 'eung', { searchCompanies: async () => ({ success: true, data: [] }) }));
  await assert.rejects(fetchCompanyManagement(original, 'eung', { searchCompanies: async () => ({ success: false, message: '조회 실패' }) }), /조회 실패/);
  for (const rangeId of ['lh-under50', 'lh-50to100']) for (const industry of ['eung', 'tongsin', 'sobang']) {
    const form = createDocumentForm();
    Object.assign(form, { ownerId: 'LH', rangeId, industry, noticeDate: '2026-11-20' });
    form.companies[0] = { ...selected, name: '신용평가 없는 업체' };
    form.companies[1] = companyFromSearch({ snapshot: { ...raw, '검색된 회사': '신용평가 만료 업체', 신용평가: 'A- (25.01.01~25.12.31)', creditScore: 15, managementScore: 15, _agreementManagementScore: 15 } });
    const application = resolveLhApplication(form, { formulasDoc, industryAverages, evaluateScores });
    for (const company of application.model.methods) {
      assert.equal(company.method, 'composite');
      assert.equal(company.creditScore, null);
      const years = resolveCandidateBusinessYears({ bizYears: 43831 }, form.noticeDate, { extractAmountValue: (candidate) => candidate.bizYears, toNumber: parseLhEvaluationNumber });
      const reference = evaluateScores({ agencyId: 'lh', amount: rangeId === 'lh-under50' ? 4500000000 : 7500000000, inputs: { debtRatio: 18.13, currentRatio: 1733, bizYears: years }, industryAvg: industryAverages[industry], formulasDoc });
      assert.equal(company.score, reference.management.composite.score);
    }
  }
  console.log('PASS: modal snapshot auto-fill, Excel serial/date/rich-text business periods, financial-only refresh, identity matching and missing/expired credit fallback for both LH ranges and all industries');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
