import { loadPersisted, savePersisted, removePersisted } from './persistence.js';

const LIST_CACHE_KEY = 'agreement-board:list';
const PAYLOAD_CACHE_KEY = 'agreement-board:payloads';

function normalizeList(items) {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => item && typeof item === 'object' && item.path);
}

function loadPayloadMap() {
  const stored = loadPersisted(PAYLOAD_CACHE_KEY, {});
  return stored && typeof stored === 'object' ? stored : {};
}

function savePayloadMap(next) {
  savePersisted(PAYLOAD_CACHE_KEY, next && typeof next === 'object' ? next : {});
}

export function getCachedAgreementBoardList() {
  return normalizeList(loadPersisted(LIST_CACHE_KEY, []));
}

export function setCachedAgreementBoardList(items) {
  savePersisted(LIST_CACHE_KEY, normalizeList(items));
}

export function upsertCachedAgreementBoardMeta(item) {
  const current = getCachedAgreementBoardList();
  const next = [item, ...current.filter((entry) => entry?.path !== item?.path)];
  setCachedAgreementBoardList(next);
}

export function removeCachedAgreementBoardMeta(path) {
  const current = getCachedAgreementBoardList();
  setCachedAgreementBoardList(current.filter((entry) => entry?.path !== path));
}

export function getCachedAgreementBoardPayload(path, savedAt = '') {
  if (!path) return null;
  const payloadMap = loadPayloadMap();
  const entry = payloadMap[path];
  if (!entry || typeof entry !== 'object') return null;
  if (savedAt && entry.savedAt && entry.savedAt !== savedAt) return null;
  return entry.payload || null;
}

export function setCachedAgreementBoardPayload(path, payload, savedAt = '') {
  if (!path) return;
  const payloadMap = loadPayloadMap();
  payloadMap[path] = {
    savedAt: String(savedAt || ''),
    payload: payload && typeof payload === 'object' ? payload : {},
    storedAt: new Date().toISOString(),
  };
  savePayloadMap(payloadMap);
}

export function removeCachedAgreementBoardPayload(path) {
  if (!path) return;
  const payloadMap = loadPayloadMap();
  if (!(path in payloadMap)) return;
  delete payloadMap[path];
  savePayloadMap(payloadMap);
}

export function clearCachedAgreementBoardPayload(path) {
  if (path) {
    removeCachedAgreementBoardPayload(path);
    return;
  }
  removePersisted(PAYLOAD_CACHE_KEY);
}
