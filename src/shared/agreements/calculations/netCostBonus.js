const UNDER_50_CONFIG = {
  priceScoreMax: 70,
  pricePenaltyMultiplier: 4,
  baseline: 65,
  expectedPriceLimit: null,
};

const FROM_50_TO_100_CONFIG = {
  priceScoreMax: 50,
  pricePenaltyMultiplier: 2,
  baseline: 45,
  expectedPriceLimit: 10000000000,
};

const CONFIGS = {
  LH: {
    'lh-under50': UNDER_50_CONFIG,
    'lh-under50-share': UNDER_50_CONFIG,
    'lh-50to100': FROM_50_TO_100_CONFIG,
    'lh-50to100-share': FROM_50_TO_100_CONFIG,
  },
  MOIS: {
    'mois-under30': UNDER_50_CONFIG,
    'mois-30to50': UNDER_50_CONFIG,
    'mois-50to100': FROM_50_TO_100_CONFIG,
  },
};

export function resolveNetCostBonusConfig(ownerId, rangeKey) {
  return CONFIGS[String(ownerId || '').trim().toUpperCase()]?.[String(rangeKey || '').trim().toLowerCase()] || null;
}

// Amounts are parsed by the caller using the board's existing input parser.
export function calculateNetCostBonus({ config, baseAmount, netCostAmount, aValue }) {
  const result = { score: 0, notice: '', penaltyNotice: false };
  if (!config || !baseAmount || !netCostAmount) return result;
  const expectedMin = Math.ceil((baseAmount * 0.988) / 1000) * 1000;
  const expectedMax = Math.ceil((baseAmount * 1.012) / 1000) * 1000;
  if (!expectedMin || !expectedMax) return result;
  if (config.expectedPriceLimit != null && expectedMax >= config.expectedPriceLimit) {
    return { ...result, notice: '예정가격 100억 초과로 순공사원가 적용 안됨' };
  }
  if (!aValue || expectedMin <= aValue || expectedMax <= aValue) return result;
  const ratios = [expectedMin, expectedMax].map((expected) => {
    const bid = netCostAmount * (expected / baseAmount) * 0.98;
    return Math.round(((bid - aValue) / (expected - aValue)) * 10000) / 10000;
  });
  if (!ratios.every(Number.isFinite)) return result;
  const bonuses = ratios.map((ratio) => (
    config.priceScoreMax - (config.pricePenaltyMultiplier * Math.abs((0.9 - ratio) * 100)) - config.baseline
  ));
  const conservative = Math.min(...bonuses);
  const truncated = Math.floor((conservative + 1e-9) * 100) / 100;
  return {
    ...result,
    score: conservative > 0 ? Math.min(truncated, 999) : 0,
    penaltyNotice: ratios.some((ratio) => ratio > 0.9),
  };
}
