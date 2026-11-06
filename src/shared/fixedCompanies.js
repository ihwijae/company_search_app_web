import { normalizeRegionName, STANDARD_REGION_NAMES } from './regionNormalizer.js';

export const FIXED_COMPANY_INDUSTRIES = [
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];
export const FIXED_COMPANY_RANGES = [
  { value: 'under50', label: '50억 미만' },
  { value: '50to100', label: '50억~100억' },
  { value: '100to300', label: '100억~300억' },
];
export const FIXED_COMPANY_REGIONS = STANDARD_REGION_NAMES;

export function normalizeCompanyIndustry(value) {
  const industry = String(value || '').toLowerCase();
  if (!FIXED_COMPANY_INDUSTRIES.some((item) => item.value === industry)) {
    throw new Error('공종을 올바르게 선택해 주세요.');
  }
  return industry;
}

export function normalizeFixedCompanyScope(scope = {}) {
  const industry = String(scope.industry || '');
  const range = String(scope.range || '');
  const region = normalizeRegionName(scope.region);
  if (!FIXED_COMPANY_INDUSTRIES.some((item) => item.value === industry)
    || !FIXED_COMPANY_RANGES.some((item) => item.value === range)
    || !FIXED_COMPANY_REGIONS.includes(region)) {
    throw new Error('공종, 금액대, 지역을 올바르게 선택해 주세요.');
  }
  return { industry, range, region };
}

export function getFixedCompanyScopeKey(scope) {
  const { industry, range, region } = normalizeFixedCompanyScope(scope);
  return `${industry}:${range}:${region}`;
}

export function getFixedCompanyKey(company) {
  const bizNo = String(company.bizNo || '').replace(/\D/g, '');
  return bizNo ? `biz:${bizNo}` : `name:${String(company.name || '').replace(/\s+/g, '').toLowerCase()}`;
}

export function normalizeFixedCompany(company) {
  if (!company || typeof company !== 'object') return null;
  const name = String(company.name || '').trim();
  if (!name) return null;
  return {
    name,
    bizNo: String(company.bizNo || '').replace(/\D/g, ''),
    companyRegion: String(company.companyRegion || '').trim(),
    managerNames: Array.isArray(company.managerNames) ? company.managerNames.map(String).filter(Boolean) : [],
    note: String(company.note || ''),
    snapshot: company.snapshot && typeof company.snapshot === 'object' && !Array.isArray(company.snapshot)
      ? company.snapshot : {},
  };
}

export function normalizeFixedCompanyList(companies = []) {
  const seen = new Set();
  return (Array.isArray(companies) ? companies : []).map(normalizeFixedCompany).filter((company) => {
    if (!company) return false;
    const key = getFixedCompanyKey(company);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
