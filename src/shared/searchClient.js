import webSearchStore from './webSearchStore.js';
import { normalizeRegionList } from './regionNormalizer.js';

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

const getSharedStatus = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && sharedStatusCache.payload && (now - sharedStatusCache.storedAt) < STATUS_CACHE_TTL_MS) {
    return sharedStatusCache.payload;
  }
  if (!force && sharedStatusCache.promise) {
    return sharedStatusCache.promise;
  }
  const request = fetchJson('/api/datasets?action=status')
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
  const payload = await getSharedStatus();
  const normalized = normalizeFileType(fileType || 'eung');
  const types = normalized === 'all' ? DATASET_TYPES : [normalized];
  await webSearchStore.syncSharedDatasets(payload, { types });
  return payload;
};

const normalizeRegionsResponse = (payload) => {
  const source = Array.isArray(payload)
    ? payload
    : (payload && Array.isArray(payload.data) ? payload.data : []);
  const normalized = normalizeRegionList(source);
  return ['전체', ...normalized];
};

const copyRowsToClipboard = async (rows) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard API is not available');
  }
  const text = Array.isArray(rows) ? rows.join('\n') : String(rows ?? '');
  await navigator.clipboard.writeText(text);
  return { success: true };
};

const extractFileNameFromContentDisposition = (headerValue, fallback = 'dataset.xlsx') => {
  const source = String(headerValue || '');
  const utf8Match = source.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch (error) {
      return utf8Match[1];
    }
  }
  const plainMatch = source.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];
  return fallback;
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
    const result = await webSearchStore.uploadFile(fileType, file);
    sharedStatusCache = { payload: null, storedAt: 0, promise: null };
    return result;
  },

  async downloadDataset(fileType) {
    const normalized = normalizeFileType(fileType);
    if (!DATASET_TYPES.includes(normalized)) {
      throw new Error('지원하지 않는 파일 유형입니다.');
    }

    const response = await fetch(`/api/datasets?action=download&fileType=${encodeURIComponent(normalized)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || `다운로드 실패 (${response.status})`);
    }

    const blob = await response.blob();
    const fileName = extractFileNameFromContentDisposition(
      response.headers.get('content-disposition'),
      `${normalized}.xlsx`,
    );
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
    return { success: true, fileName };
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
      console.warn('[searchClient] shared search failed, clearing local datasets:', error);
      if (shouldUseWebStore()) {
        await webSearchStore.clearDatasets(normalizeFileType(fileType) === 'all' ? DATASET_TYPES : [normalizeFileType(fileType)]);
        return { success: false, data: [], meta: { totalCount: 0 }, message: '업로드된 데이터셋이 없습니다.' };
      }
      return webSearchStore.searchCompanies(criteria, fileType, options);
    }
  },

  async searchManyCompanies(names = [], fileType, options = {}) {
    const api = getElectronApi();
    if (api && typeof api.searchManyCompanies === 'function') {
      return api.searchManyCompanies(names, fileType, options);
    }

    const normalizedNames = Array.from(new Set(
      (Array.isArray(names) ? names : [])
        .map((name) => String(name || '').trim())
        .filter(Boolean),
    ));

    if (normalizedNames.length === 0) {
      return { success: true, data: [] };
    }

    const normalizedType = normalizeFileType(fileType || 'all');
    const collected = [];
    for (const name of normalizedNames) {
      const response = await this.searchCompanies({ name }, normalizedType, {
        pagination: null,
        ...(options || {}),
      });
      const items = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.items)
          ? response.items
          : (Array.isArray(response) ? response : []);
      collected.push(...items);
    }

    const deduped = [];
    const seen = new Set();
    collected.forEach((item) => {
      const key = [
        String(item?._file_type || ''),
        String(item?.['사업자번호'] || ''),
        String(item?.['검색된 회사'] || ''),
      ].join('|');
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(item);
    });

    return { success: true, data: deduped };
  },

  async checkFiles() {
    const api = getElectronApi();
    if (!api || typeof api.checkFiles !== 'function') {
      try {
        const payload = await getSharedStatus();
        if (shouldUseWebStore()) {
          await webSearchStore.syncSharedDatasets(payload);
        }
        return DATASET_TYPES.reduce((acc, type) => {
          acc[type] = Boolean(payload?.meta?.datasets?.[type]);
          return acc;
        }, {});
      } catch (error) {
        console.warn('[searchClient] shared status failed, clearing local datasets:', error);
        if (shouldUseWebStore()) {
          await webSearchStore.clearDatasets();
          return { eung: false, tongsin: false, sobang: false };
        }
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
        console.warn('[searchClient] shared regions failed, clearing local datasets:', error);
        if (shouldUseWebStore()) {
          await webSearchStore.clearDatasets(normalizeFileType(fileType) === 'all' ? DATASET_TYPES : [normalizeFileType(fileType)]);
          return ['전체'];
        }
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
    return !getElectronApi();
  },

  supportsDatasetUpload() {
    const api = getElectronApi();
    return Boolean((api && typeof api.selectFile === 'function') || !api);
  },

};

export default searchClient;
