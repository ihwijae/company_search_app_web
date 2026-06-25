const PPS_CRITERIA_OWNER_IDS = new Set(['PPS', 'KGAS']);
const LEADER_BIZ_NO_OWNER_IDS = new Set(['LH', 'KGAS']);

export function normalizeOwnerKey(ownerId) {
  return String(ownerId || '').trim().toUpperCase();
}

export function usesPpsCriteria(ownerId) {
  return PPS_CRITERIA_OWNER_IDS.has(normalizeOwnerKey(ownerId));
}

export function resolveCriteriaOwnerId(ownerId) {
  return usesPpsCriteria(ownerId) ? 'PPS' : normalizeOwnerKey(ownerId);
}

export function needsLeaderBizNo(ownerId) {
  return LEADER_BIZ_NO_OWNER_IDS.has(normalizeOwnerKey(ownerId));
}

