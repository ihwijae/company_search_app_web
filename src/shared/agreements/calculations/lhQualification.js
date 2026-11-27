// LH qualification rules shared by the agreement board and document generation.
// Keep the existing board order: ratio toFixed(2), multiply, cap, score round(2).
export const LH_QUALIFICATION_RULES = {
  version: 3,
  performanceYears: 5,
  performanceMultiplier: 13,
  ratioDigits: 2,
  scoreDigits: 2,
  constructionMax: 15,
  qualityDefault: 85,
  ranges: {
    'lh-under50': {
      denominatorMultipliers: { eung: 1, tongsin: 1, sobang: 1 },
      qualityThresholds: [{ gte: 88, score: 3 }, { gte: 85, score: 2 }, { gte: 83, score: 1.5 }, { gte: 80, score: 1 }, { gte: 0, score: 0 }],
    },
    'lh-50to100': {
      qualityAggregation: 'weighted-raw',
      denominatorMultipliers: { eung: 2, tongsin: 2, sobang: 3 },
      subcontractScore: 10,
      materialScore: 10,
      qualityThresholds: [{ gte: 90, score: 5 }, { gte: 88, score: 3 }, { gte: 85, score: 2 }, { gte: 83, score: 1.5 }, { gte: 80, score: 1 }, { gte: 0, score: 0 }],
    },
  },
};

export const normalizeLhQualificationRange = (rangeId) => String(rangeId || '').toLowerCase().replace(/-share$/, '');

export function parseLhEvaluationNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const match = String(value).replace(/[,\s]/g, '').match(/-?\d+(?:\.\d+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) ? number : null;
}

export function resolveLhQualificationCriteria({ rangeId, fileType, formulasDoc } = {}) {
  const key = normalizeLhQualificationRange(rangeId);
  const range = LH_QUALIFICATION_RULES.ranges[key];
  if (!range || !Object.hasOwn(range.denominatorMultipliers, fileType)) return null;
  const tierIndex = key === 'lh-under50' ? 0 : 1;
  const agency = formulasDoc?.agencies?.find((item) => String(item.id).toLowerCase() === 'lh');
  const tier = agency?.tiers?.find((item) => Number(item.minAmount) === (tierIndex === 0 ? 0 : 5000000000));
  const max = Number(tier?.rules?.performance?.maxScore);
  const { ranges: _ranges, ...common } = LH_QUALIFICATION_RULES;
  return JSON.parse(JSON.stringify({
    ...common, rangeId: key, fileType,
    denominatorMultiplier: range.denominatorMultipliers[fileType],
    qualityThresholds: range.qualityThresholds,
    qualityAggregation: range.qualityAggregation || 'weighted-raw',
    subcontractScore: range.subcontractScore ?? null,
    materialScore: range.materialScore ?? null,
    performanceMax: Number.isFinite(max) && max > 0 ? max : common.performanceMultiplier,
    sourcePerformanceRules: tier?.rules?.performance || null,
  }));
}

export function resolveLhQualificationDenominator(baseAmount, criteria) {
  const base = Number(baseAmount);
  const multiplier = criteria?.denominatorMultiplier;
  return {
    perfectPerformanceAmount: base > 0 && multiplier > 0 ? base * multiplier : 0,
    perfectPerformanceBasis: base > 0 && multiplier > 0 ? `기초금액 × ${multiplier}배` : '',
  };
}

export function resolveLhQualificationQualityPoints(value, criteria) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return criteria.qualityThresholds.find((threshold) => score >= threshold.gte)?.score ?? 0;
}

export function evaluateLhQualificationQuality(companies, criteria) {
  const members = companies.map((company) => {
    const qualityApplied = company.qualityScore ?? criteria.qualityDefault;
    const gradeIndex = criteria.qualityThresholds.findIndex((threshold) => qualityApplied >= threshold.gte);
    return {
      ...company, qualityApplied, qualityDefaulted: company.qualityScore == null,
      qualityGrade: gradeIndex < 0 ? null : String.fromCharCode(65 + gradeIndex),
      qualityPoints: resolveLhQualificationQualityPoints(qualityApplied, criteria),
    };
  });
  const qualityTotal = members.reduce((sum, member) => sum + member.qualityApplied * (Math.max(member.share || 0, 0) / 100), 0);
  const weightedPoints = members.reduce((sum, member) => sum + member.qualityPoints * (Math.max(member.share || 0, 0) / 100), 0);
  const factor = 10 ** criteria.scoreDigits;
  // Missing aggregation on saved criteria deliberately retains the earlier rule.
  const qualityPoints = criteria.qualityAggregation === 'weighted-grade'
    ? Math.round(weightedPoints * factor) / factor
    : resolveLhQualificationQualityPoints(qualityTotal, criteria);
  return { members, qualityTotal, qualityPoints };
}

export function calculateLhQualificationPerformance(ratioRounded, maxScore, criteria = LH_QUALIFICATION_RULES) {
  const rawScore = ratioRounded * criteria.performanceMultiplier;
  return { rawScore, score: Math.min(Math.max(rawScore, 0), maxScore) };
}

export function resolveLhConstructionExperienceScore(performance, quality, { cap = true, maxScore = LH_QUALIFICATION_RULES.constructionMax } = {}) {
  const performanceValue = parseLhEvaluationNumber(performance);
  if (performanceValue == null) return null;
  const score = performanceValue + (parseLhEvaluationNumber(quality) ?? 0);
  return cap ? Math.min(Math.max(score, 0), maxScore) : score;
}

export function evaluateLhQualificationExperience({ baseAmount, companies, criteria }) {
  const denominator = resolveLhQualificationDenominator(baseAmount, criteria).perfectPerformanceAmount;
  const { members, qualityTotal, qualityPoints } = evaluateLhQualificationQuality(companies, criteria);
  const missing = [];
  if (!(denominator > 0)) missing.push('기초금액');
  if (members.some((member) => !member.name)) missing.push('참여업체');
  if (members.some((member) => member.share == null || member.share < 0 || member.share > 100)) missing.push('참여비율');
  if (members.some((member) => member.performance5y == null || member.performance5y < 0)) missing.push('5년 실적');
  const shareSum = members.reduce((sum, member) => sum + (member.share || 0), 0);
  if (!(shareSum > 0)) missing.push('참여비율 합계');
  if (missing.length) return { status: 'incomplete', missing, denominator, shareSum, members, score: null };
  const performanceAmount = members.reduce((sum, member) => sum + member.performance5y * (Math.max(member.share, 0) / 100), 0);
  const ratio = performanceAmount / denominator;
  const ratioRounded = Number(ratio.toFixed(criteria.ratioDigits));
  const evaluated = calculateLhQualificationPerformance(ratioRounded, criteria.performanceMax, criteria);
  const round = (value) => Math.round(value * 10 ** criteria.scoreDigits) / 10 ** criteria.scoreDigits;
  const performanceScore = round(evaluated.score);
  return {
    status: 'complete', missing: [], members, denominator, shareSum,
    shareComplete: Math.abs(shareSum - 100) < 0.01,
    performanceAmount, ratio, ratioRounded, performanceScore,
    performanceRawScore: round(evaluated.rawScore), qualityTotal, qualityPoints,
    score: resolveLhConstructionExperienceScore(performanceScore, qualityPoints, { maxScore: criteria.constructionMax }),
  };
}
