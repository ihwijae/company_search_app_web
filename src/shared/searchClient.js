const getElectronApi = () => {
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
};

const invokeElectron = async (method, ...args) => {
  const api = getElectronApi();
  if (!api || typeof api[method] !== 'function') {
    throw new Error(`search API method ${method} is not available`);
  }
  return api[method](...args);
};

const copyRowsToClipboard = async (rows) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available');
  }
  const text = Array.isArray(rows) ? rows.join('\n') : String(rows ?? '');
  await navigator.clipboard.writeText(text);
  return { success: true };
};

export const searchClient = {
  async selectFile(fileType) {
    return invokeElectron('selectFile', fileType);
  },

  async searchCompanies(criteria, fileType, options) {
    return invokeElectron('searchCompanies', criteria, fileType, options);
  },

  async checkFiles() {
    const api = getElectronApi();
    if (!api || typeof api.checkFiles !== 'function') {
      return {
        eung: false,
        tongsin: false,
        sobang: false,
      };
    }
    return api.checkFiles();
  },

  async getRegions(fileType) {
    const api = getElectronApi();
    if (!api || typeof api.getRegions !== 'function') {
      return { success: true, data: ['전체'] };
    }
    return api.getRegions(fileType);
  },

  onDataUpdated(callback) {
    const api = getElectronApi();
    if (!api || typeof api.onDataUpdated !== 'function') {
      return () => {};
    }
    return api.onDataUpdated(callback);
  },

  async copyCsvColumn(rows) {
    const api = getElectronApi();
    if (api && typeof api.copyCsvColumn === 'function') {
      return api.copyCsvColumn(rows);
    }
    return copyRowsToClipboard(rows);
  },

  async smppCheckOne(payload) {
    return invokeElectron('smppCheckOne', payload);
  },

  supportsSmppLookup() {
    const api = getElectronApi();
    return Boolean(api && typeof api.smppCheckOne === 'function');
  },
};

export default searchClient;
