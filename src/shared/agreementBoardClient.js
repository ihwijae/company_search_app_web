import {
  getCachedAgreementBoardList,
  setCachedAgreementBoardList,
  upsertCachedAgreementBoardMeta,
  removeCachedAgreementBoardMeta,
  getCachedAgreementBoardPayload,
  setCachedAgreementBoardPayload,
  removeCachedAgreementBoardPayload,
} from './agreementBoardCache.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || '요청 실패');
  }
  return data;
}

const agreementBoardClient = {
  getCachedList() {
    return getCachedAgreementBoardList();
  },

  async save(payload) {
    const result = await requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save', payload: payload || {} }),
    });
    if (result?.success && result?.data?.path) {
      upsertCachedAgreementBoardMeta({
        path: result.data.path,
        meta: result.data.meta || {},
      });
      if (payload && typeof payload === 'object' && payload.payload && typeof payload.payload === 'object') {
        setCachedAgreementBoardPayload(
          result.data.path,
          payload.payload,
          result?.data?.meta?.savedAt || '',
        );
      }
    }
    return result;
  },

  async list() {
    const result = await requestJson('/api/agreement-board?action=list');
    if (result?.success) {
      setCachedAgreementBoardList(result.data || []);
    }
    return result;
  },

  async load(path, options = {}) {
    const savedAt = String(options?.savedAt || '');
    const cachedPayload = getCachedAgreementBoardPayload(path, savedAt);
    if (cachedPayload) {
      return { success: true, data: cachedPayload, cached: true };
    }
    const result = await requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'load', path }),
    });
    if (result?.success) {
      setCachedAgreementBoardPayload(path, result.data || {}, savedAt);
    }
    return result;
  },

  async remove(path) {
    const result = await requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'delete', path }),
    });
    if (result?.success) {
      removeCachedAgreementBoardMeta(path);
      removeCachedAgreementBoardPayload(path);
    }
    return result;
  },

  async getRoot() {
    return requestJson('/api/agreement-board?action=root');
  },

  async pickRoot() {
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'root' }),
    });
  },
};

export default agreementBoardClient;
