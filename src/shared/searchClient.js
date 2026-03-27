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

const DATASET_TYPES = ['eung', 'tongsin', 'sobang'];
const STATUS_CACHE_TTL_MS = 30 * 1000;
let sharedStatusCache = { payload: null, storedAt: 0, promise: null };
let staticManifestCache = { payload: null, storedAt: 0, promise: null };

const normalizeFileType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'eung';
  if (normalized === '전기') return 'eung';
  if (normalized === '통신') return 'tongsin';
  if (normalized === '소방') return 'sobang';
  if (normalized === '전체') return 'all';
  return normalized;
};

const shouldUseWebStore = () => !getElectronApi() && webSearchStore.isAvailable();

const getStaticManifest = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && staticManifestCache.payload && (now - staticManifestCache.storedAt) < STATUS_CACHE_TTL_MS) {
    return staticManifestCache.payload;
  }
  if (!force && staticManifestCache.promise) {
    return staticManifestCache.promise;
  }
  const request = fetchJson('/datasets/manifest.json')
    .then((payload) => {
      staticManifestCache = {
        payload,
        storedAt: Date.now(),
        promise: null,
      };
      return payload;
    })
    .catch((error) => {
      staticManifestCache.promise = null;
      throw error;
    });
  staticManifestCache.promise = request;
  return request;
};

const getSharedStatus = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && sharedStatusCache.payload && (now - sharedStatusCache.storedAt) < STATUS_CACHE_TTL_MS) {
    return sharedStatusCache.payload;
  }
  if (!force && sharedStatusCache.promise) {
    return sharedStatusCache.promise;
  }
  const request = fetchJson('/api/datasets/status')
    .then((payload) => {
      sharedStatusCache = {
        payload,
        storedAt: Date.now(),
        promise: null,
      };
      return payload;
    })
    .catch((error) => {
      sharedStatusCache.promise = null;
      throw error;
    });
  sharedStatusCache.promise = request;
  return request;
};

const syncSharedDatasetsIfNeeded = async (fileType) => {
  if (!shouldUseWebStore()) return null;
  const payload = await getStaticManifest();
  const normalized = normalizeFileType(fileType || 'eung');
  const types = normalized === 'all' ? DATASET_TYPES : [normalized];
  await webSearchStore.syncStaticDatasets(payload, { types });
  return payload;
};

const normalizeRegionsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return ['전체'];
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
    return webSearchStore.uploadFile(fileType, file);
  },

  async searchCompanies(criteria, fileType, options) {
    const api = getElectronApi();
    if (api && typeof api.searchCompanies === 'function') {
      return api.searchCompanies(criteria, fileType, options);
    }
    try {
      if (shouldUseWebStore()) {
        await syncSharedDatasetsIfNeeded(fileType);
        return await webSearchStore.searchCompanies(criteria, normalizeFileType(fileType), options);
      }
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
        const payload = await getStaticManifest();
        if (shouldUseWebStore()) {
          await webSearchStore.syncStaticDatasets(payload);
        }
        return DATASET_TYPES.reduce((acc, type) => {
          acc[type] = Boolean(payload?.datasets?.[type]);
          return acc;
        }, {});
      } catch (error) {
        console.warn('[searchClient] static status failed, fallback to local store:', error);
        return webSearchStore.checkFiles();
      }
    }
    return api.checkFiles();
  },

  async getRegions(fileType) {
    const api = getElectronApi();
    if (!api || typeof api.getRegions !== 'function') {
      try {
        if (shouldUseWebStore()) {
          await syncSharedDatasetsIfNeeded(fileType);
          const payload = await webSearchStore.getRegions(normalizeFileType(fileType));
          return normalizeRegionsResponse(payload);
        }
        const query = new URLSearchParams({ fileType }).toString();
        const payload = await fetchJson(`/api/regions?${query}`);
        return normalizeRegionsResponse(payload);
      } catch (error) {
        console.warn('[searchClient] shared regions failed, fallback to local store:', error);
        const fallback = await webSearchStore.getRegions(fileType);
        return normalizeRegionsResponse(fallback);
      }
    }
    const result = await api.getRegions(fileType);
    return normalizeRegionsResponse(result);
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
    return false;
  },

  supportsDatasetUpload() {
    const api = getElectronApi();
    return Boolean(api && typeof api.selectFile === 'function');
  },

  usesBundledDatasets() {
    return !getElectronApi();
  },
};

export default searchClient;
