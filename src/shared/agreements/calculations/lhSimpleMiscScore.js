export function calculateLhSimpleMiscScore(sharePercents = []) {
  const totalWeight = sharePercents.reduce((sum, sharePercent) => {
    const share = Number(sharePercent);
    return Number.isFinite(share) ? sum + share / 100 : sum;
  }, 0);
  // Excel rounds the size capability and safety scores separately to 3 decimals.
  const sizeCapability = Math.round(totalWeight * 1000);
  const safetyCapability = Math.round(2 * totalWeight * 1000);
  return 10 + 4 + (sizeCapability + safetyCapability) / 1000;
}
