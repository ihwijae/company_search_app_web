import agreementsRulesClient from '../agreementsRulesClient.js';
import searchClient from '../searchClient.js';
import industryAverages from '../industryAverages.json';
import { evaluateScores } from '../evaluator.web.js';
import { evaluateSingleBidEligibility } from './rules/singleBidEligibility.js';
import { extractCreditGrade, isCreditScoreExpired } from './calculations/managementScore.js';
import { extractManagerNames } from '../../utils/companyIndicators.js';

const PAGE_SIZE = 10000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_YEAR = 365.2425 * MS_PER_DAY;
const EXCEL_DATE_EPOCH = new Date(Date.UTC(1899, 11, 30));

const normalizeFileType = (value, fallback = 'eung') => {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return fallback;
  if (token === '전기') return 'eung';
  if (token === '통신') return 'tongsin';
  if (token === '소방') return 'sobang';
  return token;
};

const normalizeText = (value) => String(value || '').trim();
const normalizeBizNo = (value) => String(value || '').replace(/[^0-9]/g, '');

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || '').replace(/[^0-9.+-]/g, '').trim();
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isValidDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const fromExcelSerial = (serial) => {
  const num = Number(serial);
  if (!Number.isFinite(num) || num <= 0) return null;
  const milliseconds = Math.round(num * MS_PER_DAY);
  const date = new Date(EXCEL_DATE_EPOCH.getTime() + milliseconds);
  return isValidDate(date) ? date : null;
};

const parseDateLike = (raw) => {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) return isValidDate(raw) ? raw : null;
  if (typeof raw === 'number') return raw > 1000 ? fromExcelSerial(raw) : null;
  const text = String(raw || '').trim();
  if (!text) return null;
  const dateMatch = text.match(/(\d{4})[^0-9]*(\d{1,2})[^0-9]*(\d{1,2})/);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const date = new Date(year, month - 1, day);
    if (isValidDate(date)) return date;
  }
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 8) {
    const year = Number(digitsOnly.slice(0, 4));
    const month = Number(digitsOnly.slice(4, 6));
    const day = Number(digitsOnly.slice(6, 8));
    const date = new Date(year, month - 1, day);
    if (isValidDate(date)) return date;
  }
  return null;
};

const parseBizYearsFromText = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const yearMonthMatch = normalized.match(/(\d+(?:\.\d+)?)\s*년\s*(\d+(?:\.\d+)?)?\s*개월?/);
  if (yearMonthMatch) {
    const yearsPart = Number(yearMonthMatch[1]);
    const monthsPart = yearMonthMatch[2] != null ? Number(yearMonthMatch[2]) : 0;
    const total = (Number.isFinite(yearsPart) ? yearsPart : 0) + (Number.isFinite(monthsPart) ? monthsPart / 12 : 0);
    return Number.isFinite(total) && total > 0 ? total : null;
  }
  const monthsOnlyMatch = normalized.match(/(\d+(?:\.\d+)?)\s*개월/);
  if (monthsOnlyMatch) {
    const months = Number(monthsOnlyMatch[1]);
    if (Number.isFinite(months) && months > 0) return months / 12;
  }
  return null;
};

const computeBizYears = (rawValue, baseDate) => {
  if (!rawValue && rawValue !== 0) return { years: null, startDate: null };
  const base = isValidDate(baseDate) ? baseDate : new Date();
  const startDate = parseDateLike(rawValue);
  if (startDate) {
    const diff = base.getTime() - startDate.getTime();
    const years = diff > 0 ? (diff / MS_PER_YEAR) : 0;
    return { years: Number.isFinite(years) ? Number(years.toFixed(4)) : 0, startDate };
  }
  if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0 && rawValue <= 200) {
    return { years: Number(rawValue.toFixed(4)), startDate: null };
  }
  const fromText = parseBizYearsFromText(rawValue);
  if (Number.isFinite(fromText) && fromText > 0) {
    return { years: Number(fromText.toFixed(4)), startDate: null };
  }
  return { years: null, startDate: null };
};

const normalizeRegionKey = (value) => String(value || '').replace(/\s+/g, '').trim().toLowerCase();

const pickRuleFromKinds = (kinds = [], fileType) => {
  if (!Array.isArray(kinds)) return null;
  const normalizedType = normalizeFileType(fileType, fileType);
  const match = kinds.find((k) => {
    if (!k || typeof k.id === 'undefined') return false;
    if (k.id === fileType) return true;
    return normalizeFileType(k.id, '') === normalizedType;
  }) || kinds.find((k) => k && k.id);
  return match?.rules || null;
};

const collectRuleSets = (rulesDoc, { ownerId, menuKey, fileType, dutyRegions }) => {
  const owners = Array.isArray(rulesDoc?.owners) ? rulesDoc.owners : [];
  const owner = owners.find((item) => item?.id === ownerId) || null;
  const globalRuleSet = pickRuleFromKinds(rulesDoc?.globalRules?.kinds, fileType);
  let rangeRuleSet = null;
  if (owner && Array.isArray(owner.ranges)) {
    const range = owner.ranges.find((item) => item?.id === menuKey) || owner.ranges.find((item) => item?.id) || null;
    if (range) rangeRuleSet = pickRuleFromKinds(range.kinds, fileType);
  }
  const ownerKindRuleSet = owner ? pickRuleFromKinds(owner.kinds, fileType) : null;
  const regionTargets = (Array.isArray(dutyRegions) ? dutyRegions : []).map(normalizeRegionKey).filter(Boolean);
  const regionRuleSets = [];
  if (regionTargets.length > 0 && Array.isArray(rulesDoc?.regions)) {
    rulesDoc.regions.forEach((region) => {
      const key = normalizeRegionKey(region?.id || region?.label || region?.region);
      if (!key || !regionTargets.includes(key)) return;
      const ruleSet = pickRuleFromKinds(region?.kinds || [], fileType);
      if (ruleSet) regionRuleSets.push(ruleSet);
    });
  }
  return [globalRuleSet, rangeRuleSet, ownerKindRuleSet, ...regionRuleSets].filter(Boolean);
};

const buildExclusionSets = (ruleSets) => {
  const excludeBiz = new Set();
  const excludeName = new Set();
  ruleSets.forEach((ruleSet) => {
    (ruleSet?.alwaysExclude || []).forEach((entry) => {
      const biz = normalizeText(entry?.bizNo);
      const name = normalizeText(entry?.name);
      if (biz) excludeBiz.add(biz);
      if (name) excludeName.add(name);
    });
  });
  return { excludeBiz, excludeName };
};

const fetchAllCompanies = async (fileType) => {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await searchClient.searchCompanies({}, fileType, { page, pageSize: PAGE_SIZE });
    if (!response?.success) {
      throw new Error(response?.message || '업체 데이터 조회 실패');
    }
    items.push(...(Array.isArray(response.data) ? response.data : []));
    const meta = response?.meta || {};
    totalPages = Number(meta.totalPages) > 0 ? Number(meta.totalPages) : 1;
    page += 1;
  } while (page <= totalPages);
  return items;
};

const resolveManagerName = (company) => {
  const direct = normalizeText(company?.['담당자명'] || company?.['담당자'] || '');
  if (direct) return direct;
  const names = extractManagerNames(company);
  return Array.isArray(names) && names[0] ? names[0] : '';
};

export async function fetchAgreementCandidates(params = {}) {
  const ownerId = params.ownerId || 'LH';
  const fileType = normalizeFileType(params.fileType || 'eung');
  const menuKey = params.menuKey || params.rangeId || '';
  const entryMode = params.entryMode === 'sum' ? 'sum' : (params.entryMode === 'none' ? 'none' : 'ratio');
  const entryAmount = entryMode === 'none' ? 0 : (params.entryAmount || params.estimatedPrice || 0);
  const baseAmount = params.baseAmount || 0;
  const estimatedAmount = params.estimatedAmount || params.estimatedPrice || 0;
  const perfectPerformanceAmount = params.perfectPerformanceAmount || 0;
  const perfectPerformanceBasis = params.perfectPerformanceBasis || '';
  const dutyRegions = Array.isArray(params.dutyRegions) ? params.dutyRegions : [];
  const excludeSingleBidEligible = params.excludeSingleBidEligible !== false;
  const filterByRegion = !!params.filterByRegion && dutyRegions.length > 0;

  const [rulesResponse, companies] = await Promise.all([
    agreementsRulesClient.load().catch(() => ({ success: true, data: {} })),
    fetchAllCompanies(fileType),
  ]);

  const rulesDoc = rulesResponse?.data && typeof rulesResponse.data === 'object' ? rulesResponse.data : {};
  const ruleSets = collectRuleSets(rulesDoc, { ownerId, menuKey, fileType, dutyRegions });
  const { excludeBiz, excludeName } = buildExclusionSets(ruleSets);
  const combinedExcludeSingleBid = ruleSets.every((set) => set?.excludeSingleBidEligible !== false);
  const shouldExcludeSingle = excludeSingleBidEligible && combinedExcludeSingleBid;

  const normalizedOwnerId = String(ownerId || '').toLowerCase();
  const normalizedMenuKey = String(menuKey || '').toLowerCase();
  const useMois3yPerformance = normalizedOwnerId === 'mois' && normalizedMenuKey === 'mois-50to100';
  const industryAvg = industryAverages[fileType] || industryAverages[String(fileType || '').toLowerCase()] || null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const evaluationDate = parseDateLike(params.evaluationDate || params.noticeDate || '') || today;
  evaluationDate.setHours(0, 0, 0, 0);

  const tierAmount = toNumber(estimatedAmount || baseAmount || entryAmount);
  const baseAmountNumber = toNumber(baseAmount);
  const perfectPerformanceNumber = toNumber(perfectPerformanceAmount) || baseAmountNumber;

  const matchesRegion = (value) => {
    if (dutyRegions.length === 0) return true;
    const target = String(value || '').trim();
    if (!target) return false;
    return dutyRegions.includes(target);
  };

  const out = [];
  companies.forEach((company) => {
    const name = normalizeText(company['검색된 회사'] || company['회사명'] || company['업체명']);
    const bizNo = normalizeText(company['사업자번호']);
    const manager = resolveManagerName(company);
    const region = normalizeText(company['대표지역'] || company['지역']);
    if ((bizNo && excludeBiz.has(bizNo)) || (!bizNo && excludeName.has(name))) return;

    const summaryStatus = normalizeText(company['요약상태']);
    const rating = toNumber(company['시평']);
    const perf5y = toNumber(company['5년 실적']);
    const perf3y = toNumber(company['3년 실적']);
    const performanceAmount = useMois3yPerformance ? perf3y : perf5y;
    const debtRatio = toNumber(company['부채비율']);
    const currentRatio = toNumber(company['유동비율']);
    const { years: bizYears, startDate: bizYearsStartDate } = computeBizYears(company['영업기간'], evaluationDate);
    const qualityEval = toNumber(company['품질평가']);
    const creditGrade = extractCreditGrade({ ...company, snapshot: company });
    const creditExpired = isCreditScoreExpired({ ...company, snapshot: company });

    const evaluation = evaluateScores({
      agencyId: normalizedOwnerId,
      amount: tierAmount,
      inputs: {
        debtRatio,
        currentRatio,
        bizYears,
        qualityEval,
        perf5y: performanceAmount,
        perf3y,
        baseAmount: baseAmountNumber,
        estimatedAmount: tierAmount,
        creditGrade,
        fileType,
      },
      industryAvg,
    });

    const composite = evaluation?.management?.composite || {};
    const credit = evaluation?.management?.credit || {};
    const managementScore = Number.isFinite(Number(evaluation?.management?.score)) ? Number(evaluation.management.score) : null;
    const managementMax = Number.isFinite(Number(evaluation?.management?.meta?.maxScore)) ? Number(evaluation.management.meta.maxScore) : null;
    const regionOk = matchesRegion(region);
    const singleBid = evaluateSingleBidEligibility({
      entryAmount: entryMode === 'none' ? 0 : entryAmount,
      performanceTarget: perfectPerformanceNumber > 0 ? perfectPerformanceNumber : baseAmountNumber,
      performanceLabel: perfectPerformanceBasis || '기초금액',
      baseAmount: baseAmountNumber,
      dutyRegions,
      sipyungAmount: rating,
      performanceAmount,
      region,
      regionOk,
      managementScore,
      managementMax,
      managementRequired: true,
    });

    if (shouldExcludeSingle && singleBid.ok) return;
    if (filterByRegion && singleBid.region.ok === false) return;

    out.push({
      id: normalizeBizNo(bizNo) || name,
      name,
      bizNo,
      manager,
      region,
      rating,
      perf5y: performanceAmount,
      perf3y,
      sipyung: rating,
      '시평금액': rating,
      '기초금액': rating,
      '기초금액(원)': rating,
      performance5y: performanceAmount,
      performance3y: perf3y,
      '시평': rating,
      '시평액': rating,
      '시평액(원)': rating,
      '5년 실적': performanceAmount,
      '5년실적': performanceAmount,
      '5년 실적 합계': performanceAmount,
      '최근5년실적': performanceAmount,
      '최근5년실적합계': performanceAmount,
      '5년실적금액': performanceAmount,
      '최근5년시공실적': performanceAmount,
      '3년 실적': perf3y,
      '3년실적': perf3y,
      '3년 실적 합계': perf3y,
      '최근3년실적': perf3y,
      '최근3년실적합계': perf3y,
      '3년실적금액': perf3y,
      '최근3년시공실적': perf3y,
      '여성기업': company['여성기업'],
      '품질평가': company['품질평가'],
      summaryStatus,
      isLatest: summaryStatus === '최신',
      '요약상태': summaryStatus,
      debtRatio,
      currentRatio,
      debtScore: composite?.parts?.debtScore ?? null,
      currentScore: composite?.parts?.currentScore ?? null,
      bizYears,
      bizYearsStartDate: bizYearsStartDate && isValidDate(bizYearsStartDate)
        ? `${bizYearsStartDate.getFullYear()}-${String(bizYearsStartDate.getMonth() + 1).padStart(2, '0')}-${String(bizYearsStartDate.getDate()).padStart(2, '0')}`
        : null,
      bizYearsScore: composite?.parts?.yearsScore ?? null,
      bizYearsMaxScore: composite?.maxScore ?? null,
      debtMaxScore: composite?.maxScore ?? null,
      currentMaxScore: composite?.maxScore ?? null,
      creditMaxScore: credit?.maxScore ?? null,
      creditScore: creditExpired ? null : (credit?.score ?? null),
      creditGrade,
      creditNote: creditExpired ? 'expired' : '',
      creditNoteText: normalizeText(company['신용메모'] || company['신용평가'] || ''),
      managementTotalScore: managementScore,
      managementScore,
      managementMaxScore: managementMax,
      managementIsPerfect: Boolean(evaluation?.management?.meta?.isPerfect),
      moneyOk: singleBid.entry.applied ? singleBid.entry.ok : null,
      perfOk: singleBid.performance.applied ? singleBid.performance.ok : null,
      regionOk: singleBid.region.applied ? singleBid.region.ok : null,
      singleBidReasons: Array.isArray(singleBid.reasons) ? singleBid.reasons.filter(Boolean) : [],
      singleBidFacts: singleBid?.facts || null,
      singleBidDetails: singleBid,
      singleBidEligible: Boolean(singleBid.ok),
      wasAlwaysExcluded: false,
      qualityEval,
      reasons: [
        (shouldExcludeSingle && singleBid.ok) ? '단독 가능' : null,
        singleBid.entry.applied && singleBid.entry.ok === false ? '시평 미달' : null,
        singleBid.performance.applied && singleBid.performance.ok === false ? '실적 미달' : null,
        singleBid.region.applied && singleBid.region.ok === false ? '지역 불일치' : null,
      ].filter(Boolean),
    });
  });

  return { success: true, data: out };
}

export default fetchAgreementCandidates;
