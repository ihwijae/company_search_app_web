import { getCandidateTextField } from '../../../../utils/companyIndicators.js';
import { managementFieldsFromSearch } from '../documentForm.js';

const bizKey = (value) => String(value || '').replace(/\D/g, '');
const nameKey = (value) => String(value || '').replace(/㈜|\(주\)|주식회사|\s/g, '').toLowerCase();

export async function fetchCompanyManagement(company, industry, { searchCompanies } = {}) {
  if (!company.name) throw new Error('업체를 먼저 선택해 주세요.');
  if (!searchCompanies) {
    const { default: client } = await import('../../../../shared/searchClient.js');
    searchCompanies = (...args) => client.searchCompanies(...args);
  }
  const response = await searchCompanies({ name: company.name }, industry, { forceWebSearch: true, pagination: null });
  if (!response?.success) throw new Error(response?.message || '업체 경영상태 정보를 불러오지 못했습니다.');
  const businessNumber = bizKey(company.bizNo);
  const matches = (response.data || []).filter((candidate) => businessNumber
    ? bizKey(getCandidateTextField(candidate, ['사업자번호', '사업자등록번호', 'bizNo'])) === businessNumber
    : nameKey(getCandidateTextField(candidate, ['검색된 회사', '업체명', 'name'])) === nameKey(company.name));
  if (matches.length !== 1) throw new Error(matches.length ? '같은 업체의 조회 결과가 여러 건입니다. 업체 조회에서 정확한 업체를 다시 선택해 주세요.' : '선택한 업체의 최신 정보를 찾지 못했습니다. 업체 조회에서 확인해 주세요.');
  return managementFieldsFromSearch(matches[0]);
}
