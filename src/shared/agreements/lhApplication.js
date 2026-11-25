import { extractCreditGrade, isCreditScoreExpired } from './calculations/creditEvaluation.js';
import { resolveCandidateBusinessYears } from './calculations/businessYears.js';
import { parseLhEvaluationNumber } from './calculations/lhQualification.js';

const APPLICATION_PLEDGE = '위 건 공사입찰에 대한 적격심사에 대하여 적격심사 관련 제증빙자료를 신의성실의 원칙에 입각하여 붙임과 같이 작성 제출하며, 만일 제출한 서류가 허위 또는 부정한 방법으로 작성된 사실이 확인될 경우에는 귀 공사의 적격심사세부기준에서 정한 바에 따라 처리하여도 아무런 이의를 제기하지 않겠음을 확약합니다.';
const FOOTNOTES = [
  '주1. 공동도급인 경우 구성원의 경영상태 평가 방법이 서로 다른 경우 위 ------- 란에 구성원을 명기하여 구분하여 기재',
  '주2. 제출서류 목록은 모두 기재 및 첨부서류를 순서에 맞게 편철',
];
const COMPANY_FIELDS = ['name', 'bizNo', 'representative', 'address', 'creditGradeText', 'creditExpiry', 'creditExpired', 'creditStatus', 'debtRatio', 'currentRatio', 'bizYears', 'managementMethod'];
const companyInputs = (company) => Object.fromEntries(COMPANY_FIELDS.map((key) => [key, company[key] || (key === 'managementMethod' ? 'auto' : '')]));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const managementInputs = (inputs) => ({
  noticeDate: inputs.noticeDate,
  companies: inputs.companies.map((company) => Object.fromEntries(COMPANY_FIELDS.filter((field) => !['representative', 'address'].includes(field)).map((field) => [field, company[field]]))),
});

export function resolveLhApplicationManagement(company, { criteria, noticeDate, rangeId, industry, evaluateScores }) {
  const expired = isCreditScoreExpired({ ...company, dataStatus: { credit: company.creditStatus } }, { evaluationDate: noticeDate });
  const grade = expired ? '' : extractCreditGrade(company);
  const debtRatio = parseLhEvaluationNumber(company.debtRatio);
  const currentRatio = parseLhEvaluationNumber(company.currentRatio);
  const bizYears = resolveCandidateBusinessYears(company, noticeDate, {
    toNumber: parseLhEvaluationNumber,
    extractAmountValue: (candidate) => candidate.bizYears,
  });
  const inputs = { fileType: industry };
  if (debtRatio != null) inputs.debtRatio = debtRatio;
  if (currentRatio != null) inputs.currentRatio = currentRatio;
  if (bizYears != null) inputs.bizYears = bizYears;
  if (grade) inputs.creditGrade = grade;
  const result = evaluateScores({
    agencyId: 'lh', amount: rangeId === 'lh-under50' ? 4500000000 : 7500000000,
    inputs, formulasDoc: criteria.formulasDoc, industryAvg: criteria.industryAvg,
  });
  const management = result.management;
  const hasFinancial = debtRatio != null && currentRatio != null && bizYears != null;
  const creditTable = criteria.formulasDoc.agencies[0].tiers.find((tier) => tier.minAmount === (rangeId === 'lh-under50' ? 0 : 5000000000))?.rules.management.methods.find((method) => method.id === 'credit')?.gradeTable || [];
  const hasCredit = !expired && creditTable.some((row) => String(row.grade).toUpperCase() === grade);
  const requestedMethod = company.managementMethod || 'auto';
  const method = requestedMethod === 'auto' ? management?.chosen : requestedMethod;
  const complete = method === 'credit' ? hasCredit : hasFinancial;
  const validationMessage = requestedMethod === 'credit' && !hasCredit
    ? (expired ? '선택한 신용평가가 만료되었습니다. 유효한 신용평가를 입력하거나 재무비율 평가를 선택해 주세요.' : '신용평가로 평가하려면 유효한 신용등급을 입력해 주세요.')
    : requestedMethod === 'composite' && !hasFinancial ? '재무비율 평가에 필요한 부채비율·유동비율·영업기간을 입력해 주세요.' : '';
  return {
    name: company.name, method: complete ? method : null, expired, creditGrade: grade,
    financialScore: management?.composite?.score ?? null,
    creditScore: hasCredit ? management?.credit?.score ?? null : null,
    score: complete ? management?.[method]?.score ?? null : null,
    requestedMethod, validationMessage,
    detailsVersion: 1,
    financialDetails: { debtRatio, currentRatio, bizYears, parts: management?.composite?.parts || {} },
    creditDetails: { base: hasCredit ? management?.credit?.base : null },
  };
}

export function resolveLhApplication(form, { previousSnapshot = null, formulasDoc, industryAverages, evaluateScores, now = new Date().toISOString() } = {}) {
  if (form.ownerId !== 'LH' || form.reviewType !== 'qualification' || !['lh-under50', 'lh-50to100'].includes(form.rangeId)) return null;
  const scope = { ownerId: form.ownerId, reviewType: form.reviewType, rangeId: form.rangeId, industry: form.industry };
  const inputs = {
    noticeNo: form.noticeNo, noticeTitle: form.noticeTitle, noticeDate: form.noticeDate,
    bidDeadline: form.bidDeadline, writtenDate: form.writtenDate,
    companies: form.companies.slice(0, form.companyCount).map(companyInputs),
  };
  const previous = previousSnapshot?.version === 1 && same(previousSnapshot.scope, scope) ? previousSnapshot : null;
  const previousInputs = previous ? { ...previous.inputs, companies: previous.inputs.companies.map(companyInputs) } : null;
  const hasDetails = previous?.model.methods.every((company) => company.detailsVersion === 1);
  if (previous && hasDetails && same(previousInputs, inputs)) return previous;
  const agency = formulasDoc.agencies.find((item) => item.id === 'lh');
  const criteria = previous?.criteria || JSON.parse(JSON.stringify({
    version: 1, formulasDoc: { agencies: [agency] }, industryAvg: industryAverages[form.industry],
  }));
  const reuseManagement = previous && same(managementInputs(previousInputs), managementInputs(inputs));
  const methods = reuseManagement && hasDetails ? previous.model.methods : inputs.companies.map((company, index) => {
    const evaluated = resolveLhApplicationManagement(company, { criteria, noticeDate: form.noticeDate, rangeId: form.rangeId, industry: form.industry, evaluateScores });
    return reuseManagement ? { ...evaluated, ...previous.model.methods[index], detailsVersion: 1, financialDetails: evaluated.financialDetails, creditDetails: evaluated.creditDetails } : evaluated;
  });
  const creditNames = methods.filter((company) => company.method === 'credit').map((company) => company.name);
  const financialNames = methods.filter((company) => company.method === 'composite').map((company) => company.name);
  const clauses = [];
  if (creditNames.length) clauses.push(`${creditNames.join(', ')}에 대해서는 신용평가등급 등에 의한 방법`);
  if (financialNames.length) clauses.push(`${financialNames.join(', ')}에 대해서는 부채비율 등에 의한 방법`);
  const methodRequest = methods.some((company) => !company.method)
    ? '[업체별 경영상태 평가정보를 확인해 주세요.]'
    : `또한, 경영상태 평가 시 부채비율 등에 의한 방법과 신용평가등급 등에 의한 방법 중 ${clauses.join('으로, ')}으로 평가하여 주시기 바랍니다.`;
  const missing = [];
  for (const [key, label] of [['noticeNo', '공고번호'], ['noticeTitle', '공사명'], ['noticeDate', '공고일'], ['bidDeadline', '입찰마감일시'], ['writtenDate', '작성날짜']]) {
    if (!String(inputs[key] || '').trim()) missing.push(label);
  }
  inputs.companies.forEach((company, index) => {
    if (!company.name.trim()) missing.push(`${index === 0 ? '대표사' : `구성사 ${index}`} 업체 선택`);
    if (!methods[index].method) missing.push(`${company.name || `업체 ${index + 1}`} ${methods[index].validationMessage || '경영상태 평가정보'}`);
  });
  const leader = inputs.companies[0];
  if (!leader.address.trim()) missing.push('대표사 주소');
  if (!leader.representative.trim()) missing.push('대표사 대표자');
  return {
    version: 1, scope, inputs, criteria, capturedAt: now, criteriaCapturedAt: previous?.criteriaCapturedAt || now,
    model: {
      templateVersion: 1, title: '적 격 심 사 신 청 서', formLabel: '[별지 제1호서식]',
      noticeNo: inputs.noticeNo, noticeTitle: inputs.noticeTitle, bidDeadline: inputs.bidDeadline,
      writtenDate: inputs.writtenDate, leader: { name: leader.name, address: leader.address, representative: leader.representative },
      paragraph: `${APPLICATION_PLEDGE} ${methodRequest}`,
      attachmentText: '붙임 : 제출서류목록(주2.)', recipient: '한 국 토 지 주 택 공 사 사 장 귀하',
      footnotes: FOOTNOTES, methods, missing, complete: missing.length === 0,
    },
  };
}
