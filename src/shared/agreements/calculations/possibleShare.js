export function calculatePossibleShareRatio(possibleShareBase, sipyungAmount) {
  if (possibleShareBase == null || possibleShareBase === '') return null;
  if (sipyungAmount == null || sipyungAmount === '') return null;
  const base = Number(possibleShareBase);
  const sipyung = Number(sipyungAmount);
  if (!Number.isFinite(base) || base <= 0) return null;
  if (!Number.isFinite(sipyung) || sipyung < 0) return null;
  const ratio = (sipyung / base) * 100;
  return Number.isFinite(ratio) && ratio >= 0 ? ratio : null;
}

export function formatPossibleShareValue(ratio) {
  const numeric = Number(ratio);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric >= 100) return '';
  if (numeric === 0) return '0';
  // Keep all possible-share displays aligned with Excel `TRUNC(AA2/AC2,4)`.
  // `numeric` is a percent ratio, so convert to fraction and use the
  // four-decimal truncation unit directly as a two-decimal percent value.
  const truncatedFractionUnits = Math.trunc((numeric / 100) * 10000 + 1e-10);
  const resolved = truncatedFractionUnits / 100;
  return resolved.toFixed(2).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function formatPossibleShareText(ratio, options) {
  const value = formatPossibleShareValue(ratio, options);
  return value ? `${value}%` : '';
}
