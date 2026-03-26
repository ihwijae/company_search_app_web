import webSearchStore from './webSearchStore.js';

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

const fetchJson = async (url, init = {}) => {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is not available');
  }
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
};

const readFileAsBase64 = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
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

  async uploadFile(fileType, file) {
    const api = getElectronApi();
    if (api && typeof api.selectFile === 'function') {
      throw new Error('Electron 환경에서는 기존 파일 선택 흐름을 사용하세요.');
    }
    const fileBase64 = await readFileAsBase64(file);
    return fetchJson('/api/datasets/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileType,
        fileName: file.name,
        contentType: file.type,
        fileBase64,
      }),
    });
  },

  async searchCompanies(criteria, fileType, options) {
    const api = getElectronApi();
    if (api && typeof api.searchCompanies === 'function') {
      return api.searchCompanies(criteria, fileType, options);
    }
    try {
      return await fetchJson('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria, fileType, options }),
      });
    } catch (error) {
      console.warn('[searchClient] shared search failed, fallback to local store:', error);
      return webSearchStore.searchCompanies(criteria, fileType, options);
    }
  },

  async checkFiles() {
    const api = getElectronApi();
    if (!api || typeof api.checkFiles !== 'function') {
      try {
        const payload = await fetchJson('/api/datasets/status');
        return payload?.data || { eung: false, tongsin: false, sobang: false };
      } catch (error) {
        console.warn('[searchClient] shared status failed, fallback to local store:', error);
        return webSearchStore.checkFiles();
      }
    }
    return api.checkFiles();
  },

  async getRegions(fileType) {
    const api = getElectronApi();
    if (!api || typeof api.getRegions !== 'function') {
      try {
        const query = new URLSearchParams({ fileType }).toString();
        return await fetchJson(`/api/regions?${query}`);
      } catch (error) {
        console.warn('[searchClient] shared regions failed, fallback to local store:', error);
        return webSearchStore.getRegions(fileType);
      }
    }
    return api.getRegions(fileType);
  },

  onDataUpdated(callback) {
    const api = getElectronApi();
    if (!api || typeof api.onDataUpdated !== 'function') {
      return webSearchStore.onDataUpdated(callback);
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

  supportsBrowserUpload() {
    return !getElectronApi() && webSearchStore.isAvailable();
  },
};

export default searchClient;
