export function calculateMinimumPerformanceAmount({
  perfectPerformanceAmount,
  currentContributionAmount,
  targetSharePercent,
} = {}) {
  const threshold = Number(perfectPerformanceAmount);
  const currentContribution = Number(currentContributionAmount);
  const targetShare = Number(targetSharePercent);

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { status: 'missing-threshold' };
  }
  if (!Number.isFinite(currentContribution) || currentContribution < 0) {
    return { status: 'invalid-current' };
  }
  if (!Number.isFinite(targetShare) || targetShare <= 0) {
    return { status: 'invalid-share' };
  }

  const shareFactor = targetShare / 100;
  const remainingWeightedAmount = Math.max(0, threshold - currentContribution);
  const minimumPerformanceAmount = remainingWeightedAmount <= 0
    ? 0
    : Math.ceil(remainingWeightedAmount / shareFactor);

  return {
    status: 'ok',
    currentContributionAmount: currentContribution,
    perfectPerformanceAmount: threshold,
    targetSharePercent: targetShare,
    remainingWeightedAmount,
    minimumPerformanceAmount,
  };
}
