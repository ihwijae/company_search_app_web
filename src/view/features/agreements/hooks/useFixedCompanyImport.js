import useBoardCompanyImport from './useBoardCompanyImport.js';
import fixedCompaniesClient from '../../../../shared/fixedCompaniesClient.js';
import { resolveFixedCompanyImportScopes, selectFixedCompaniesForBoard, placeFixedCompanyEntries } from '../../../../shared/agreements/fixedCompanyImport.js';

const validateImport = (context) => {
  try {
    resolveFixedCompanyImportScopes(context);
    return '';
  } catch (error) {
    return error.message;
  }
};

const loadCompanies = async (context) => selectFixedCompaniesForBoard(await fixedCompaniesClient.load(), context);

export default function useFixedCompanyImport(options) {
  return useBoardCompanyImport({ ...options, loadCompanies, validateImport, placeEntries: placeFixedCompanyEntries, title: '고정업체 불러오기' });
}
