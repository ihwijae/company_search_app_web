import fixedCompaniesClient from '../../../../shared/fixedCompaniesClient.js';
import searchClient from '../../../../shared/searchClient.js';
import { FIXED_COMPANY_INDUSTRIES, getFixedCompanyKey } from '../../../../shared/fixedCompanies.js';

export function filterOwnCorporations(companies, document) {
  const keysByIndustry = new Map(FIXED_COMPANY_INDUSTRIES.map(({ value }) => [
    value,
    new Set((document.ownCorporations?.[value]?.companies || []).map(getFixedCompanyKey)),
  ]));
  return companies.filter((company) => {
    const keys = keysByIndustry.get(company._file_type);
    const identity = {
      bizNo: company['사업자번호'],
      name: company['검색된 회사'] || company['회사명'],
    };
    return keys?.has(getFixedCompanyKey(identity))
      || keys?.has(getFixedCompanyKey({ name: identity.name }));
  });
}

export default async function searchOwnCorporations(criteria, options = {}) {
  const document = await fixedCompaniesClient.load();
  const response = await searchClient.searchCompanies(criteria, 'all', {
    ...options,
    forceWebSearch: true,
    pagination: null,
  });
  if (!response?.success) return response;

  // Filter before paging so counts and page boundaries include only our corporations.
  const companies = filterOwnCorporations(response.data || [], document);
  const totalCount = companies.length;
  const pageSize = options.pagination?.pageSize;
  if (!pageSize) return { success: true, data: companies, meta: { totalCount } };
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(Math.max(options.pagination.page || 1, 1), totalPages);
  const start = (page - 1) * pageSize;
  return {
    success: true,
    data: companies.slice(start, start + pageSize),
    meta: { totalCount, totalPages, page, pageSize },
  };
}
