const NET_COST_BID_RANGES = new Set(['mois-30to50', 'mois-50to100']);

export function usesNetCostBidFloor(ownerId, rangeKey) {
  return String(ownerId || '').trim().toUpperCase() === 'MOIS'
    && NET_COST_BID_RANGES.has(String(rangeKey || '').trim().toLowerCase());
}

// Rates are fractions (e.g. 1.016 and 0.87495); amounts are parsed numbers.
export function calculateBidAmount({ ownerId, rangeKey, baseAmount, bidRate, adjustmentRate, aValue, useAValue, netCostAmount }) {
  const empty = { amount: 0, standardAmount: 0, netCostFloor: 0, usesNetCostFloor: false };
  if (!baseAmount || baseAmount <= 0 || !Number.isFinite(bidRate) || !Number.isFinite(adjustmentRate)) return empty;
  const expectedPrice = baseAmount * adjustmentRate;
  const a = aValue || 0;
  const standardAmount = useAValue
    ? Math.round(((expectedPrice - a) * bidRate) + a)
    : Math.round(baseAmount * bidRate * adjustmentRate);
  const netCostFloor = usesNetCostBidFloor(ownerId, rangeKey) && Number.isFinite(netCostAmount) && netCostAmount > 0
    ? Math.ceil(netCostAmount * adjustmentRate * 0.98)
    : 0;
  const usesNetCostFloor = netCostFloor > 0 && netCostFloor > standardAmount;
  return {
    amount: usesNetCostFloor ? netCostFloor : standardAmount,
    standardAmount,
    netCostFloor,
    usesNetCostFloor,
  };
}
