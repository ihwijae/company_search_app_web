export function calculatePossibleShareRatio(possibleShareBase, sipyungAmount) {
  const base = Number(possibleShareBase);
  const sipyung = Number(sipyungAmount);
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(sipyung) || sipyung <= 0) return null;
  const ratio = (sipyung / base) * 100;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

function truncateDecimal(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.trunc(value * factor) / factor;
}

export function formatPossibleShareValue(ratio, { mode = 'round' } = {}) {
  const numeric = Number(ratio);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric >= 100) return '';
  // Keep calculation semantics aligned with Excel `TRUNC(Z2/AC2,4)`.
  // `numeric` is a percent ratio, so convert to fraction -> TRUNC(4) -> back to percent.
  const truncatedByExcelRule = truncateDecimal(numeric / 100, 4) * 100;
  const resolved = mode === 'truncate'
    ? truncateDecimal(truncatedByExcelRule, 2)
    : truncateDecimal(truncatedByExcelRule, 2);
  return resolved.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function formatPossibleShareText(ratio, options) {
  const value = formatPossibleShareValue(ratio, options);
  return value ? `${value}%` : '';
}
