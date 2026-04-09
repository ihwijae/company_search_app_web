const PERFORMANCE_DEFAULT_MAX = 13;

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

  if (isKrailUnder50SobangDebug) {
    const base = Number(perfBase);
    const estimated = Number(estimatedValue);
    const amountHint = Number(evaluationAmount);
    const isUnder50Range = Number.isFinite(amountHint) && amountHint > 0 && amountHint < 5000000000;
    if (Number.isFinite(base) && base > 0 && isUnder50Range) {
      const multiplier = Number.isFinite(estimated) && estimated >= 3000000000 ? 3 : 2;
      const ratio = perfAmount / (base * multiplier);
      const roundedRatio = Number.isFinite(ratio) ? Number(ratio.toFixed(2)) : null;
      const directScore = roundedRatio != null ? clampScore(roundedRatio * 15, 15) : null;
      console.warn('[KRAIL_UNDER50_SOBANG][performanceScore] direct override', {
        perfAmount,
        base,
        estimated,
        multiplier,
        ratio,
        roundedRatio,
        directScore,
      });
      if (directScore != null) return directScore;
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
              return {
                score: resolved,
                rawScore: resolvedRaw,
                maxScore: perfMax,
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
