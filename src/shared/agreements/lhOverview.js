import { LH_QUALIFICATION_RULES, parseLhEvaluationNumber } from './calculations/lhQualification.js';
import { buildGroupSummaryMetrics } from './calculations/groupSummary.js';
import { evaluateLhBidPrice, LH_BID_PRICE_RULES } from './calculations/lhBidPrice.js';
import { buildLhManagementPage } from './lhManagement.js';
import { withFixedLhCredibility } from './lhCredibility.js';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function completeOverview(snapshot) {
  const document = withFixedLhCredibility(snapshot);
  const bidPricePage = {
    inputs: { bidAmount: document.inputs.bidAmount || '', expectedPrice: document.inputs.expectedPrice || '', aValue: document.inputs.aValue || '' },
    criteria: document.criteria.bidPrice || { ...LH_BID_PRICE_RULES },
    result: document.model.bidResult || null,
    score: document.model.scores.bid,
  };
  return same(document.model.bidPricePage, bidPricePage) ? document : { ...document, model: { ...document.model, bidPricePage } };
}

export function resolveLhOverview(form, { previousSnapshot = null, application, experience, now = new Date().toISOString() } = {}) {
  if (form.ownerId !== 'LH' || form.reviewType !== 'qualification' || form.rangeId !== 'lh-50to100' || !application || !experience) return null;
  const scope = { ownerId: form.ownerId, reviewType: form.reviewType, rangeId: form.rangeId, industry: form.industry };
  const previous = previousSnapshot?.version === 1 && same(previousSnapshot.scope, scope) ? previousSnapshot : null;
  const experiencePage = { criteria: experience.criteria, result: experience.result };
  const companyProfiles = form.companies.slice(0, form.companyCount).map((company) => Object.fromEntries(
    ['name', 'representative', 'registrationNo', 'sipyungAmount', 'rank', 'address', 'phone', 'writer', 'bizNo', 'corporateNo'].map((key) => [key, company[key] || '']),
  ));
  const inputs = {
    noticeNo: form.noticeNo, noticeTitle: form.noticeTitle, bidDeadline: form.bidDeadline,
    estimatedPrice: form.estimatedPrice, baseAmount: form.baseAmount,
    bidAmount: form.bidAmount || '', expectedPrice: form.expectedPrice || '', aValue: form.aValue || '',
    members: form.companies.slice(0, form.companyCount).map((company, index) => ({
      name: company.name, share: parseLhEvaluationNumber(company.share), managementScore: application.model.methods[index]?.score ?? null,
      managementMethod: application.model.methods[index]?.method ?? null,
    })),
    experienceResult: experience.result,
    managementDetails: application.model.methods,
    managementCompanyFields: form.companies.slice(0, form.companyCount).map((company) => ({ creditAgency: company.creditAgency, bizYears: company.bizYears })),
  };
  const previousInputs = previous ? { ...previous.inputs, bidAmount: previous.inputs.bidAmount || '', expectedPrice: previous.inputs.expectedPrice || '', aValue: previous.inputs.aValue || '' } : null;
  if (previous && Object.keys(inputs).every((key) => same(previousInputs[key], inputs[key]))) {
    const priorPage = previous.model.experiencePage;
    const resolvedPage = priorPage && priorPage.criteria.qualityAggregation === experience.criteria.qualityAggregation ? priorPage : experiencePage;
    if (same(previous.model.companyProfiles, companyProfiles) && resolvedPage === priorPage && previous.model.managementPage) return completeOverview(previous);
    return completeOverview({ ...previous, capturedAt: now, criteria: { ...previous.criteria, experienceRules: resolvedPage.criteria }, model: { ...previous.model, companyProfiles, experiencePage: resolvedPage, managementPage: previous.model.managementPage || buildLhManagementPage(form, application, previous.model.scores.management) } });
  }
  const tier = application.criteria.formulasDoc.agencies.find((agency) => agency.id === 'lh')?.tiers.find((item) => item.minAmount === 5000000000);
  const managementMax = Math.max(...(tier?.rules.management.methods || []).map((method) => Number(method.maxScore) || 0));
  const criteria = previous?.criteria || {
    version: 1,
    managementMax,
    scoreDigits: LH_QUALIFICATION_RULES.scoreDigits,
    subcontractScore: LH_QUALIFICATION_RULES.ranges['lh-50to100'].subcontractScore,
    materialScore: LH_QUALIFICATION_RULES.ranges['lh-50to100'].materialScore,
    managementRules: application.criteria,
    experienceRules: experience.criteria,
  };
  const bidCriteria = criteria.bidPrice || { ...LH_BID_PRICE_RULES };
  const updatedCriteria = { ...criteria, bidPrice: bidCriteria, experienceRules: experience.criteria };
  const bidResult = evaluateLhBidPrice(inputs, bidCriteria);
  const ids = inputs.members.map((member, index) => String(index));
  const participantMap = new Map(inputs.members.map((candidate, index) => [String(index), { candidate }]));
  const [metric] = buildGroupSummaryMetrics({
    groupAssignments: [ids], participantMap,
    getSharePercent: (group, slot, member) => member.share,
    getCandidateManagementScore: (member) => member.managementScore,
    getCandidatePerformanceAmountForCurrentRange: () => null,
    getCandidateSipyungAmount: () => null,
  });
  const validMembers = inputs.members.every((member) => member.name && member.share != null && member.share >= 0 && member.share <= 100);
  const managementReady = validMembers && metric.shareValid && !metric.managementMissing;
  const factor = 10 ** criteria.scoreDigits;
  const managementScore = managementReady
    ? Math.round(Math.min(Math.max(metric.managementScore, 0), criteria.managementMax) * factor) / factor
    : null;
  const constructionScore = validMembers && experience.result.status === 'complete' ? experience.result.score : null;
  const scores = {
    total: null, subtotal: null, construction: constructionScore, management: managementScore,
    credibility: null, subcontract: criteria.subcontractScore, material: criteria.materialScore, bid: bidResult.score,
  };
  const missing = [];
  if (!form.noticeNo) missing.push('공고번호');
  if (!form.noticeTitle) missing.push('공사명');
  if (!form.bidDeadline) missing.push('입찰마감일시');
  if (!validMembers || !metric.shareValid) missing.push('참여업체와 참여비율');
  if (!metric.shareComplete) missing.push('참여비율 합계 100% 확인');
  if (managementScore == null) missing.push('업체별 경영상태 평가정보');
  if (constructionScore == null) missing.push('시공경험 평가정보');
  missing.push(...bidResult.missing);
  return completeOverview({
    version: 1, scope, inputs, criteria: updatedCriteria, capturedAt: now, criteriaCapturedAt: previous?.criteriaCapturedAt || now,
    model: {
      templateVersion: 1, formLabel: '[별지 제2호서식]', rangeNote: '<별표 2의 경우>',
      title: '적격심사 자기평가 및 심사표', noticeNo: form.noticeNo, noticeTitle: form.noticeTitle, bidDeadline: form.bidDeadline,
      scores, members: inputs.members, companyProfiles, experiencePage, managementPage: buildLhManagementPage(form, application, managementScore), missing, calculatedReady: missing.length === 0,
      pending: ['신인도'], complete: false, bidResult,
      managementRawScore: managementReady ? metric.managementScore : null,
      shareSum: metric.shareSum,
    },
  });
}
