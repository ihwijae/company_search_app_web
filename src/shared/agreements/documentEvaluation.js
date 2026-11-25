import { resolveLhQualificationCriteria, evaluateLhQualificationExperience, parseLhEvaluationNumber as parseEvaluationNumber } from './calculations/lhQualification.js';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function resolveDocumentExperience(form, { previousSnapshot = null, formulasDoc, now = new Date().toISOString() } = {}) {
  const scope = { ownerId: form.ownerId, reviewType: form.reviewType, rangeId: form.rangeId || '', industry: form.industry };
  if (scope.ownerId !== 'LH' || scope.reviewType !== 'qualification') return null;
  const previous = previousSnapshot?.version === 1 && same(previousSnapshot.scope, scope) ? previousSnapshot : null;
  const savedCriteria = previous?.criteria || resolveLhQualificationCriteria({ rangeId: scope.rangeId, fileType: scope.industry, formulasDoc });
  const upgrade = scope.rangeId === 'lh-50to100' && savedCriteria?.qualityAggregation !== 'weighted-grade';
  const criteria = upgrade ? { ...savedCriteria, qualityAggregation: 'weighted-grade', qualityRevisionAppliedAt: now } : savedCriteria;
  if (!criteria) return null;
  const inputs = {
    baseAmount: parseEvaluationNumber(form.baseAmount),
    companies: form.companies.slice(0, form.companyCount).map((company) => ({
      name: company.name, bizNo: company.bizNo, share: parseEvaluationNumber(company.share),
      performance5y: parseEvaluationNumber(company.performance5y), qualityScore: parseEvaluationNumber(company.qualityScore),
    })),
  };
  // Keep pinned criteria except the quality aggregation now required by default.
  if (previous && !upgrade && same(previous.inputs, inputs)) return previous;
  return {
    version: 1, scope, criteria, evaluatedAt: now,
    criteriaCapturedAt: previous?.criteriaCapturedAt || now,
    inputs,
    result: evaluateLhQualificationExperience({ ...inputs, criteria }),
  };
}
