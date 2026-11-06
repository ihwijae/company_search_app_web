import {
  getFixedCompanyScopeKey,
  FIXED_COMPANY_INDUSTRIES,
} from '../fixedCompanies.js';
import { normalizeRegionList, normalizeRegionName } from '../regionNormalizer.js';
import { buildStoredCompanyCandidates } from './storedCompanyCandidates.js';
import { placeRegionEntries } from './placement/regionImport.js';

export function resolveFixedCompanyRange({ ownerId, menuKey, rangeId }) {
  const rangeKey = String(menuKey || rangeId || '').toLowerCase();
  if (String(ownerId || '').toUpperCase() === 'MOIS'
    && ['mois-under30', 'mois-30to50'].includes(rangeKey)) return 'under50';
  return rangeKey.match(/-(under50|50to100|100to300)$/)?.[1] || null;
}

export function resolveFixedCompanyImportScopes(context) {
  const range = resolveFixedCompanyRange(context);
  if (!range) throw new Error('현재 금액대에 연결된 고정업체 설정이 없습니다.');
  const industry = String(context.fileType || '').toLowerCase();
  if (!FIXED_COMPANY_INDUSTRIES.some((item) => item.value === industry)) {
    throw new Error('협정보드 헤더에서 공종을 먼저 선택해 주세요.');
  }
  const regions = normalizeRegionList(context.dutyRegions);
  if (!regions.length) throw new Error('협정보드 헤더에서 의무지역을 먼저 선택해 주세요.');
  return regions.map((region) => {
    const scope = { industry, range, region };
    return { ...scope, key: getFixedCompanyScopeKey(scope) };
  });
}

export function selectFixedCompaniesForBoard(document, context) {
  const scopes = resolveFixedCompanyImportScopes(context);
  const companies = scopes.flatMap((scope) => document.groups?.[scope.key]?.companies || []);
  return buildStoredCompanyCandidates(companies, context.fileType);
}

export function resolveFixedCompanyPlacementSlot(candidate, context) {
  const companyRegion = normalizeRegionName(candidate.region || candidate.companyRegion
    || candidate.snapshot?.['대표지역'] || candidate.snapshot?.['지역']);
  const dutyRegions = normalizeRegionList(context.dutyRegions);
  return companyRegion && dutyRegions.includes(companyRegion) ? 1 : 0;
}

export function placeFixedCompanyEntries(assignments, entries, groupSize, context) {
  return placeRegionEntries(assignments, entries, groupSize,
    (entry) => resolveFixedCompanyPlacementSlot(entry.candidate, context));
}
