import { normalizeCompanyIndustry } from '../fixedCompanies.js';
import { buildStoredCompanyCandidates } from './storedCompanyCandidates.js';
import { placeRegionEntries } from './placement/regionImport.js';

export function selectOwnCorporationsForBoard(document, context) {
  const industry = normalizeCompanyIndustry(context.fileType);
  return buildStoredCompanyCandidates(document.ownCorporations?.[industry]?.companies || [], industry, 'own-corporation');
}

export function placeOwnCorporationEntries(assignments, entries, groupSize) {
  return placeRegionEntries(assignments, entries, groupSize, () => 0);
}
