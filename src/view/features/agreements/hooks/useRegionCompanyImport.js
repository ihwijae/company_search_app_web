import useBoardCompanyImport from './useBoardCompanyImport.js';
import {
  buildInitialRegionSearchParams,
  fetchRegionCandidates,
  computeRegionCandidateShares,
  filterRegionCandidates,
  sortRegionCandidates,
} from '../../../../shared/agreements/regionCandidateService.js';

const validateImport = (payload) => {
  if (!payload.dutyRegions?.length) return '협정보드 헤더에서 의무지역을 먼저 선택해 주세요.';
  const params = buildInitialRegionSearchParams(payload);
  return String(params.entryAmount || params.baseAmount || payload.estimatedAmount || '').trim()
    ? '' : '협정보드 헤더에 공고 금액정보를 먼저 입력해 주세요.';
};

const loadCompanies = async (payload, onlyLatest) => {
  const params = buildInitialRegionSearchParams(payload);
  const list = await fetchRegionCandidates(payload, params);
  const ratioBase = Number(String(params.ratioBase || '').replace(/[^0-9]/g, '')) || 0;
  const sorted = sortRegionCandidates(filterRegionCandidates(computeRegionCandidateShares(list, ratioBase), { params, onlyLatest }));
  return sorted.filter((item) => !item.singleBidEligible && item.regionOk !== false);
};

export default function useRegionCompanyImport(options) {
  return useBoardCompanyImport({ ...options, loadCompanies, validateImport, title: '지역사불러오기' });
}
