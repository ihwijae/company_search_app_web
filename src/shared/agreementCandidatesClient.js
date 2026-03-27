import fetchAgreementCandidates from './agreements/candidateFetchService.js';

const getElectronApi = () => {
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
};

const agreementCandidatesClient = {
  async fetchCandidates(params = {}) {
    const api = getElectronApi();
    if (api && typeof api.fetchCandidates === 'function') {
      return api.fetchCandidates(params);
    }
    return fetchAgreementCandidates(params);
  },
};

export default agreementCandidatesClient;
