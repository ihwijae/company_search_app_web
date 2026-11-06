import { normalizeFixedCompanyList, getFixedCompanyKey } from '../fixedCompanies.js';

export function buildStoredCompanyCandidates(companies, fileType, source = 'fixed') {
  return normalizeFixedCompanyList(companies).map((company) => {
    const snapshot = { ...company.snapshot, _file_type: fileType };
    return {
      id: `${source}:${fileType}:${getFixedCompanyKey(company)}`,
      name: company.name,
      bizNo: company.bizNo,
      region: company.companyRegion || snapshot['대표지역'] || snapshot['지역'] || '',
      snapshot,
      source,
      _file_type: fileType,
    };
  });
}
