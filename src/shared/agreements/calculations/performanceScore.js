const PERFORMANCE_DEFAULT_MAX = 13;

function truncateTo(value, digits = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** digits;
  return Math.trunc(numeric * factor + 1e-10) / factor;
}

function roundTo(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const factor = 10 ** digits;
  return Math.round(numeric * factor) / factor;
}

export function resolvePerformanceCap(value, fallback = PERFORMANCE_DEFAULT_MAX) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

export async function evaluateAgreementPerformanceScore(perfAmount, {
  performanceBaseReady = false,
  agencyId,
  fileType,
  evaluationAmount,
  perfBase,
  roundRatioBaseAmount,
  estimatedValue,
  perfCoefficient,
  roundRatioDigits,
  formulasEvaluate,
  updatePerformanceCap,
  getPerformanceCap,
  toNumber,
  clampScore,
  returnDetails = false,
} = {}) {
  if (!performanceBaseReady || perfAmount == null) return null;
  const isKrailUnder50SobangDebug = String(agencyId || '').toLowerCase() === 'krail'
    && String(fileType || '').toLowerCase() === 'sobang';

  if (Number.isFinite(Number(perfCoefficient)) && Number(perfCoefficient) > 0) {
    const amount = Number(perfAmount);
    const base = Number(perfBase);
    const coefficient = Number(perfCoefficient);
    const denominator = base * coefficient;
    if (Number.isFinite(amount) && Number.isFinite(denominator) && denominator > 0) {
      const ratioRaw = amount / denominator;
      const ratioRounded = truncateTo(ratioRaw, 4);
      const rawScore = ratioRounded != null ? roundTo(ratioRounded * 11, 3) : null;
      const maxScore = resolvePerformanceCap(11, PERFORMANCE_DEFAULT_MAX);
      const score = rawScore != null ? clampScore(rawScore, maxScore) : null;
      if (score != null) {
        if (returnDetails) {
          return {
            score,
            rawScore,
            maxScore,
            ratioRaw,
            ratioRounded,
          };
        }
        return score;
      }
    }
  }

  if (isKrailUnder50SobangDebug) {
    const base = Number(perfBase);
    const estimated = Number(estimatedValue);
    const amountHint = Number(evaluationAmount);
    const isUnder50Range = Number.isFinite(amountHint) && amountHint > 0 && amountHint < 5000000000;
    if (Number.isFinite(base) && base > 0 && isUnder50Range) {
      const multiplier = Number.isFinite(estimated) && estimated >= 3000000000 ? 3 : 2;
      const ratio = perfAmount / (base * multiplier);
      const roundedRatio = Number.isFinite(ratio) ? Number(ratio.toFixed(2)) : null;
      const rawScore = roundedRatio != null ? roundTo(roundedRatio * 15, 3) : null;
      const directScore = rawScore != null ? clampScore(rawScore, 15) : null;
      console.warn('[KRAIL_UNDER50_SOBANG][performanceScore] direct override', {
        perfAmount,
        base,
        estimated,
        multiplier,
        ratio,
        roundedRatio,
        rawScore,
        directScore,
      });
      if (directScore != null) {
        if (returnDetails) {
          return {
            score: directScore,
            rawScore,
            maxScore: 15,
            ratioRaw: ratio,
            ratioRounded: roundedRatio,
          };
        }
        return directScore;
      }
    }
  }

  const payload = {
    agencyId,
    fileType,
    amount: evaluationAmount != null ? evaluationAmount : (perfBase != null ? perfBase : 0),
    inputs: {
      perf5y: perfAmount,
      perf3y: perfAmount,
      baseAmount: perfBase,
      estimatedAmount: estimatedValue,
      perfCoefficient,
      fileType,
    },
  };

  const parseRatioDetails = () => {
    const amount = Number(perfAmount);
    if (!Number.isFinite(amount)) return { ratioRaw: null, ratioRounded: null };
    const preferredBase = Number(roundRatioBaseAmount);
    const fallbackBase = Number(perfBase);
    const denominator = (Number.isFinite(preferredBase) && preferredBase > 0)
      ? preferredBase
      : ((Number.isFinite(fallbackBase) && fallbackBase > 0) ? fallbackBase : null);
    if (!(denominator > 0)) return { ratioRaw: null, ratioRounded: null };
    const ratioRaw = amount / denominator;
    if (!Number.isFinite(ratioRaw)) return { ratioRaw: null, ratioRounded: null };
    const digits = Number(roundRatioDigits);
    const useDigits = Number.isInteger(digits) && digits >= 0;
    const ratioRounded = useDigits ? Number(ratioRaw.toFixed(digits)) : ratioRaw;
    return { ratioRaw, ratioRounded };
  };

  if (isKrailUnder50SobangDebug) {
    console.warn('[KRAIL_UNDER50_SOBANG][performanceScore] request', {
      perfAmount,
      performanceBaseReady,
      agencyId,
      fileType,
      evaluationAmount,
      perfBase,
      roundRatioBaseAmount,
      estimatedValue,
      perfCoefficient,
      roundRatioDigits,
      payload,
    });
  }

  if (typeof formulasEvaluate === 'function') {
    try {
      const response = await formulasEvaluate(payload);
      if (isKrailUnder50SobangDebug) {
        console.warn('[KRAIL_UNDER50_SOBANG][performanceScore] formulas response', response);
      }
      if (response?.success && response.data?.performance) {
        const perfData = response.data.performance;
        const perfMax = updatePerformanceCap(perfData.maxScore);
        const { score, capped, raw } = perfData;
        const numericCandidates = [score, capped, raw]
          .map((value) => toNumber(value))
          .filter((value) => value !== null);
        if (numericCandidates.length > 0) {
          const resolvedRaw = toNumber(raw) ?? Math.max(...numericCandidates);
          const resolved = clampScore(Math.max(...numericCandidates), perfMax);
          if (isKrailUnder50SobangDebug) {
            console.warn('[KRAIL_UNDER50_SOBANG][performanceScore] resolved from formulas', {
              score,
              capped,
              raw,
              perfMax,
              numericCandidates,
              resolvedRaw,
              resolved,
            });
          }
          if (resolved != null) {
            if (returnDetails) {
              const { ratioRaw, ratioRounded } = parseRatioDetails();
              return {
                score: resolved,
                rawScore: resolvedRaw,
                maxScore: perfMax,
                ratioRaw,
                ratioRounded,
              };
            }
            return resolved;
          }
        }
      }
    } catch (err) {
      console.warn('[AgreementBoard] performance evaluate failed:', err?.message || err);
    }
    // Formula evaluation exists but did not yield a valid score.
    // Do not fallback to alternate equations to avoid silent rule drift.
    return null;
  }

  return null;
}
