import fetchAgreementCandidates from './candidateFetchService.js';
import { usesPpsCriteria } from './ownerCriteria.js';
import { getCandidateTextField, extractManagerNames } from '../../utils/companyIndicators.js';

// Shared by the region search window and board import. Keep selection rules here.
export function buildInitialRegionSearchParams({
  ownerId = 'LH', menuKey = '', entryMode = 'ratio', entryAmount = '', baseAmount = '',
  estimatedAmount = '', perfectPerformanceAmount = 0, dutyRegions = [],
  showPossibleShareLimit = true, bidAmount = '', ratioBaseAmount = '',
  bidRate = '', adjustmentRate = '', defaultExcludeSingle = true,
}) {
  const isMoisUnder30 = String(ownerId).toUpperCase() === 'MOIS' && menuKey === 'mois-under30';
  const perfAmountValue = Number(perfectPerformanceAmount) > 0 ? String(perfectPerformanceAmount) : '';
  const initialBase = isMoisUnder30
    ? (perfAmountValue || estimatedAmount || entryAmount || '')
    : (baseAmount || '');
  const defaultRatioSource = showPossibleShareLimit
    ? (usesPpsCriteria(String(ownerId).toUpperCase()) ? (bidAmount || ratioBaseAmount || '') : (ratioBaseAmount || bidAmount || ''))
    : '';
  return {
    entryAmount: entryMode !== 'none' ? (entryAmount || '') : '',
    baseAmount: initialBase,
    dutyRegions: dutyRegions || [],
    ratioBase: (isMoisUnder30 || !showPossibleShareLimit) ? '' : defaultRatioSource,
    bidAmount: (isMoisUnder30 || !showPossibleShareLimit) ? '' : (bidAmount || defaultRatioSource),
    bidRate: bidRate || '',
    adjustmentRate: adjustmentRate || '',
    minPct: '', maxPct: '',
    excludeSingleBidEligible: defaultExcludeSingle,
    filterByRegion: true,
  };
}

export async function fetchRegionCandidates(context, requestParams) {
  const filterByRegion = !!requestParams.filterByRegion && requestParams.dutyRegions?.length > 0;
  const response = await fetchAgreementCandidates({
    ownerId: context.ownerId,
    menuKey: context.menuKey,
    rangeId: context.rangeId,
    fileType: context.fileType,
    entryAmount: requestParams.entryAmount,
    entryMode: context.entryMode,
    baseAmount: requestParams.baseAmount,
    estimatedAmount: context.estimatedAmount,
    perfectPerformanceAmount: Number(context.perfectPerformanceAmount) > 0
      ? String(context.perfectPerformanceAmount) : requestParams.baseAmount,
    perfectPerformanceBasis: context.perfectPerformanceBasis,
    dutyRegions: filterByRegion ? requestParams.dutyRegions : [],
    excludeSingleBidEligible: requestParams.excludeSingleBidEligible,
    filterByRegion,
    evaluationDate: context.noticeDate,
  });
  if (!response?.success) throw new Error(response?.message || '후보 요청 실패');
  return enrichRegionCandidates(response.data || []);
}

export function parseRegionCandidateNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.+-]/g, '').trim();
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function enrichRegionCandidates(items) {
  return (items || []).map((item) => {
    const snapshot = { ...item };
    const debtRatioRaw = parseRegionCandidateNumber(item.debtRatio ?? item['부채비율']);
    const currentRatioRaw = parseRegionCandidateNumber(item.currentRatio ?? item['유동비율']);
    const debtAgainstAvg = Number(item.debtAgainstAverage ?? item['부채평균대비']);
    const currentAgainstAvg = Number(item.currentAgainstAverage ?? item['유동평균대비']);
    const creditScoreRaw = item.creditScore ?? null;
    const creditGradeSource = item['신용평가'] ?? '';
    const creditGradeRaw = item.creditGrade ?? creditGradeSource;
    const creditNoteOriginal = item.creditNoteText ?? item['신용메모'] ?? '';
    const creditNoteStatus = item.creditNote ?? '';
    const bizYearsValue = (() => {
      const candidates = [
        item.bizYears,
        item['영업기간'],
        snapshot.bizYears,
        snapshot['영업기간'],
      ];
      for (const candidateValue of candidates) {
        if (candidateValue === null || candidateValue === undefined || candidateValue === '') continue;
        const parsed = parseRegionCandidateNumber(candidateValue);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    })();
    const bizYearsScoreValue = (() => {
      const raw = item.bizYearsScore;
      if (raw === null || raw === undefined || raw === '') return null;
      const num = Number(raw);
      return Number.isFinite(num) ? num : null;
    })();
    const bizYearsMaxScoreValue = (() => {
      const raw = item.bizYearsMaxScore;
      if (raw === null || raw === undefined || raw === '') return null;
      const num = Number(raw);
      return Number.isFinite(num) ? num : null;
    })();
    const bizYearsStartDate = (() => {
      const raw = item.bizYearsStartDate || snapshot.bizYearsStartDate;
      if (!raw) return null;
      const date = new Date(raw);
      return Number.isNaN(date.getTime()) ? null : date;
    })();
    const singleBidReasons = Array.isArray(item.singleBidReasons)
      ? item.singleBidReasons.filter(Boolean)
      : [];
    const singleBidFacts = (() => {
      const rawFacts = item.singleBidFacts;
      if (!rawFacts || typeof rawFacts !== 'object') return null;
      const regionRaw = rawFacts.region != null ? String(rawFacts.region).trim() : '';
      const safeNumber = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const num = parseRegionCandidateNumber(v);
        return Number.isFinite(num) ? num : null;
      };
      return {
        sipyung: safeNumber(rawFacts.sipyung),
        perf5y: safeNumber(rawFacts.perf5y),
        entry: safeNumber(rawFacts.entry),
        base: safeNumber(rawFacts.base),
        region: regionRaw,
      };
    })();
    return {
      ...item,
      snapshot,
      debtRatio: debtRatioRaw,
      currentRatio: currentRatioRaw,
      debtScore: item.debtScore ?? null,
      currentScore: item.currentScore ?? null,
      debtAgainstAverage: Number.isFinite(debtAgainstAvg) && debtAgainstAvg > 0 ? debtAgainstAvg : null,
      currentAgainstAverage: Number.isFinite(currentAgainstAvg) && currentAgainstAvg > 0 ? currentAgainstAvg : null,
      creditScore: creditScoreRaw != null ? Number(creditScoreRaw) : null,
      creditGrade: creditGradeRaw ? String(creditGradeRaw).toUpperCase() : '',
      creditGradeText: creditGradeSource ? String(creditGradeSource) : '',
      creditNote: creditNoteStatus ? String(creditNoteStatus).toLowerCase() : '',
      creditNoteText: creditNoteOriginal ? String(creditNoteOriginal) : '',
      debtMaxScore: item.debtMaxScore ?? null,
      currentMaxScore: item.currentMaxScore ?? null,
      creditMaxScore: item.creditMaxScore ?? null,
      bizYears: bizYearsValue,
      bizYearsScore: bizYearsScoreValue,
      bizYearsMaxScore: bizYearsMaxScoreValue,
      bizYearsStartDate,
      singleBidReasons,
      singleBidFacts,
      _sipyung: (() => {
        const candidates = [
          item.sipyung,
          item.rating,
          item['시평'],
          item['시평액'],
          item['시평액(원)'],
          item['기초금액'],
          item['기초금액(원)'],
          snapshot.rating,
          snapshot['시평'],
          snapshot['시평액'],
          snapshot['시평액(원)'],
          snapshot['기초금액'],
          snapshot['기초금액(원)'],
        ];
        for (const candidateValue of candidates) {
          const parsed = parseRegionCandidateNumber(candidateValue);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      })(),
      _performance5y: (() => {
        const candidates = [
          item.performance5y,
          item.perf5y,
          item['5년 실적'],
          item['5년실적'],
          item['5년 실적 합계'],
          item['최근5년실적'],
          item['최근5년실적합계'],
          item['5년실적금액'],
          item['최근5년시공실적'],
          snapshot.perf5y,
          snapshot['5년 실적'],
          snapshot['5년실적'],
          snapshot['5년 실적 합계'],
          snapshot['최근5년실적'],
          snapshot['최근5년실적합계'],
          snapshot['5년실적금액'],
          snapshot['최근5년시공실적'],
        ];
        for (const candidateValue of candidates) {
          const parsed = parseRegionCandidateNumber(candidateValue);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      })(),
      _score: (() => {
        const candidates = [
          item.score,
          item.totalScore,
          item['총점'],
          item['평균점수'],
          item['적격점수'],
          item['종합점수'],
          item['평가점수'],
          snapshot['총점'],
          snapshot['평균점수'],
          snapshot['적격점수'],
          snapshot['종합점수'],
          snapshot['평가점수'],
        ];
        for (const candidateValue of candidates) {
          const parsed = parseRegionCandidateNumber(candidateValue);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      })(),
      _share: (() => {
        const candidates = [
          item.share,
          item['_pct'],
          item.candidateShare,
          item['지분'],
          item['기본지분'],
          snapshot['share'],
          snapshot['_pct'],
          snapshot['지분'],
        ];
        for (const candidateValue of candidates) {
          const parsed = parseRegionCandidateNumber(candidateValue);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      })(),
    };
  });
}

export function computeRegionCandidateShares(list, ratioBase) {
  return (list || []).map((c) => {
    let pctRaw = null; let pct = null;
    if (ratioBase > 0) {
      const r = Number(c.rating || 0);
      if (Number.isFinite(r) && r > 0) {
        pctRaw = (r / ratioBase) * 100;        // 정렬은 원시 비율값으로만
        pct = Math.floor(pctRaw * 100) / 100;  // 표시값은 둘째자리 내림
      }
    }
    return { ...c, _pct: pct, _pctRaw: pctRaw };
  });
}

export function filterRegionCandidates(computed, { params, onlyLatest = false, excluded = new Set(), searchQuery = '', managerQuery = '' }) {
  const toFloat = (s) => {
    const t = String(s ?? '').trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  const min = toFloat(params.minPct);
  const max = toFloat(params.maxPct);
  const normalizedQuery = String(searchQuery || '').trim().toLowerCase();
  const normalizedManagerQuery = String(managerQuery || '').trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;
  const hasManagerQuery = normalizedManagerQuery.length > 0;
  return computed.map((c) => {
    const summaryStatus = (c.summaryStatus || c['요약상태'] || '').trim();
    return { ...c, summaryStatus };
  }).filter((c) => {
    if (excluded.has(c.id)) return false;
    if (params.excludeSingleBidEligible && c.singleBidEligible && !c.wasAlwaysIncluded) return false;
    if (onlyLatest && !c.isLatest) return false;
    if (params.filterByRegion && Array.isArray(params.dutyRegions) && params.dutyRegions.length > 0 && c.regionOk === false && !c.wasAlwaysIncluded) return false;
    if (min !== null && (c._pct === null || c._pct < min)) return false;
    if (max !== null && (c._pct === null || c._pct > max)) return false;
    if (hasQuery) {
      const textFields = [
        getCandidateTextField(c, ['name', '검색된 회사', '업체명']),
        getCandidateTextField(c, ['대표자', '대표자명']),
        getCandidateTextField(c, ['manager', '담당자', '담당자명']),
        getCandidateTextField(c, ['region', '대표지역', '지역']),
        getCandidateTextField(c, ['bizNo', '사업자번호']),
      ];
      const managerMatch = extractManagerNames(c).some((name) => name && name.toLowerCase().includes(normalizedQuery));
      const textMatch = textFields.some((value) => value && String(value).toLowerCase().includes(normalizedQuery));
      if (!textMatch && !managerMatch) return false;
    }
    if (hasManagerQuery) {
      const directManagerFields = [
        getCandidateTextField(c, ['manager', '담당자', '담당자명', '담당자1', '담당'])
      ];
      const listManagers = extractManagerNames(c);
      const matchesDirect = directManagerFields.some((value) => value && String(value).toLowerCase().includes(normalizedManagerQuery));
      const matchesList = listManagers.some((value) => value && String(value).toLowerCase().includes(normalizedManagerQuery));
      if (!matchesDirect && !matchesList) return false;
    }
    return true;
  });
}

export function sortRegionCandidates(filtered, sortKey = 'share', sortDir = 'desc') {
  const arr = filtered.slice();
  const accessor = (item) => {
    switch (sortKey) {
      case 'perf5y':
        return Number.isFinite(Number(item._performance5y)) ? Number(item._performance5y) : null;
      case 'sipyung':
        return Number.isFinite(Number(item._sipyung)) ? Number(item._sipyung) : null;
      case 'share':
      default:
        return item._pctRaw != null && Number.isFinite(Number(item._pctRaw)) ? Number(item._pctRaw) : null;
    }
  };
  arr.sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    const aNull = av == null;
    const bNull = bv == null;
    if (aNull && bNull) {
      return String(a.name || '').localeCompare(String(b.name || ''), 'ko-KR');
    }
    if (aNull) return 1;
    if (bNull) return -1;
    const diff = sortDir === 'asc' ? (av - bv) : (bv - av);
    if (diff !== 0) return diff;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ko-KR');
  });
  return arr;
}
