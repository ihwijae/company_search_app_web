export function calculateMinimumSipyungAmountForSum({
  qualificationAmount,
  currentSipyungAmount,
} = {}) {
  const threshold = Number(qualificationAmount);
  const currentAmount = Number(currentSipyungAmount);

  if (!Number.isFinite(threshold) || threshold <= 0) {
    return { status: 'missing-threshold' };
  }
  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return { status: 'invalid-current' };
  }

  const minimumSipyungAmount = Math.max(0, Math.ceil(threshold - currentAmount));

  return {
    status: 'ok',
    qualificationAmount: threshold,
    currentSipyungAmount: currentAmount,
    minimumSipyungAmount,
  };
}

export function calculateMinimumSipyungAmountForRatio({
  qualificationAmount,
  currentContributionAmount,
  targetSharePercent,
} = {}) {
  const threshold = Number(qualificationAmount);
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
  const minimumSipyungAmount = remainingWeightedAmount <= 0
    ? 0
    : Math.ceil(remainingWeightedAmount / shareFactor);

  return {
    status: 'ok',
    qualificationAmount: threshold,
    currentContributionAmount: currentContribution,
    targetSharePercent: targetShare,
    remainingWeightedAmount,
    minimumSipyungAmount,
  };
}
