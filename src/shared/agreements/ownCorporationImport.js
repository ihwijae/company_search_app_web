import { normalizeCompanyIndustry } from '../fixedCompanies.js';
import { buildStoredCompanyCandidates } from './storedCompanyCandidates.js';

export function selectOwnCorporationsForBoard(document, context) {
  const industry = normalizeCompanyIndustry(context.fileType);
  return buildStoredCompanyCandidates(document.ownCorporations?.[industry]?.companies || [], industry, 'own-corporation');
}
