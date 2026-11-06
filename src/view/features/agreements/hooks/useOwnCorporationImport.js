import useBoardCompanyImport from './useBoardCompanyImport.js';
import fixedCompaniesClient from '../../../../shared/fixedCompaniesClient.js';
import { normalizeCompanyIndustry } from '../../../../shared/fixedCompanies.js';
import { selectOwnCorporationsForBoard } from '../../../../shared/agreements/ownCorporationImport.js';
import { placeFixedCompanyEntries } from '../../../../shared/agreements/fixedCompanyImport.js';

const validateImport = (context) => {
  try {
    normalizeCompanyIndustry(context.fileType);
    return '';
  } catch {
    return '협정보드 헤더에서 공종을 먼저 선택해 주세요.';
  }
};
const loadCompanies = async (context) => selectOwnCorporationsForBoard(await fixedCompaniesClient.load(), context);

export default function useOwnCorporationImport(options) {
  return useBoardCompanyImport({ ...options, loadCompanies, validateImport,
    placeEntries: placeFixedCompanyEntries, title: '우리법인 불러오기' });
}
