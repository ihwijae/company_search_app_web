import { parseLhEvaluationNumber } from './lhQualification.js';

// LH 50억~100억: provided 입찰가격.png, including its four-decimal ratio.
export const LH_BID_PRICE_RULES = {
  version: 1, maxScore: 50, targetRatio: 0.9, coefficient: 2, ratioDigits: 4, scoreDigits: 2,
};

export function evaluateLhBidPrice({ bidAmount, expectedPrice, aValue }, criteria = LH_BID_PRICE_RULES) {
  const bid = parseLhEvaluationNumber(bidAmount);
  const expected = parseLhEvaluationNumber(expectedPrice);
  const a = parseLhEvaluationNumber(aValue);
  const missing = [];
  if (!(bid > 0)) missing.push('입찰가격 (0원 초과)');
  if (!(expected > 0)) missing.push('예정가격 (0원 초과)');
  if (a == null || a < 0) missing.push('A값 (0원 이상)');
  if (expected > 0 && a != null && a >= 0 && expected <= a) missing.push('예정가격은 A값보다 커야 합니다');
  if (bid > 0 && a != null && a >= 0 && bid < a) missing.push('입찰가격은 A값 이상이어야 합니다');
  if (missing.length) return { status: 'incomplete', missing, score: null };
  const ratio = (bid - a) / (expected - a);
  const ratioRounded = Number(ratio.toFixed(criteria.ratioDigits));
  const rawScore = criteria.maxScore - criteria.coefficient * Math.abs((criteria.targetRatio - ratioRounded) * 100);
  const factor = 10 ** criteria.scoreDigits;
  return { status: 'complete', missing: [], ratio, ratioRounded, rawScore, score: Math.round(rawScore * factor) / factor };
}
