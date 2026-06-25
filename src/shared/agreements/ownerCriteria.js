export function normalizeOwnerKey(ownerId) {
  return String(ownerId || '').trim().toUpperCase();
}

export function isKgasOwner(ownerId) {
  const raw = String(ownerId || '').trim();
  if (!raw) return false;
  return normalizeOwnerKey(raw) === 'KGAS' || /한국가스공사|가스공사/i.test(raw);
}

export function isLhOwner(ownerId) {
  const raw = String(ownerId || '').trim();
  if (!raw) return false;
  return normalizeOwnerKey(raw) === 'LH' || /한국토지주택공사|주택공사/i.test(raw);
}

export function usesPpsCriteria(ownerId) {
  const key = normalizeOwnerKey(ownerId);
  return key === 'PPS' || isKgasOwner(ownerId);
}

export function resolveCriteriaOwnerId(ownerId) {
  return usesPpsCriteria(ownerId) ? 'PPS' : normalizeOwnerKey(ownerId);
}

export function needsLeaderBizNo(ownerId) {
  return isLhOwner(ownerId) || isKgasOwner(ownerId);
}
