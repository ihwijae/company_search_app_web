import React from 'react';
import {
  REGION_IMPORTED_FLAG,
  getRegionCompanyKey,
  placeRegionEntries,
} from '../../../../shared/agreements/placement/regionImport.js';

const placeMemberEntries = (assignments, entries, groupSize) => placeRegionEntries(assignments, entries, groupSize);

export default function useBoardCompanyImport({
  open, buildRegionSearchPayload, candidates, excluded, participantMap,
  groupAssignments, setGroupAssignments, safeGroupSize, onUpdateBoard,
  notify, portalContainer, loadCompanies, validateImport, title, placeEntries = placeMemberEntries,
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [pendingKeys, setPendingKeys] = React.useState(null);
  const busyRef = React.useRef(false);
  const requestIdRef = React.useRef(0);
  const latestRef = React.useRef(null);
  latestRef.current = { open, payload: buildRegionSearchPayload(), candidates, excluded, participantMap, groupAssignments };
  const announce = React.useCallback((message, type = 'info') => {
    notify({ title, message, type, portalTarget: portalContainer || null });
  }, [notify, portalContainer, title]);

  React.useEffect(() => {
    if (open) return;
    requestIdRef.current += 1;
    setDialogOpen(false);
    setPendingKeys(null);
    busyRef.current = false;
    setLoading(false);
  }, [open]);

  React.useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  // Wait until the board has created its participant IDs, then place the batch.
  React.useEffect(() => {
    if (!open || !pendingKeys) return;
    const byKey = new Map(Array.from(participantMap.values()).map((entry) => [getRegionCompanyKey(entry.candidate), entry]));
    if (pendingKeys.some((key) => !byKey.has(key))) return;
    const entries = pendingKeys.map((key) => byKey.get(key));
    const result = placeEntries(groupAssignments, entries, safeGroupSize, latestRef.current.payload);
    setGroupAssignments(result.assignments);
    setPendingKeys(null);
    busyRef.current = false;
    setLoading(false);
    announce(`${result.placedCount}개 업체를 배치했습니다.${result.addedRows ? ` 빈 행 ${result.addedRows}개를 추가했습니다.` : ''}`);
  }, [open, pendingKeys, participantMap, groupAssignments, safeGroupSize, setGroupAssignments, announce, placeEntries]);

  const importCompanies = async (onlyLatest) => {
    if (busyRef.current) return;
    if (safeGroupSize < 2) {
      announce('업체를 배치할 구성사 자리가 없습니다.', 'warning');
      return;
    }
    const start = latestRef.current;
    const validationMessage = validateImport(start.payload);
    if (validationMessage) {
      announce(validationMessage, 'warning');
      return;
    }
    const requestId = ++requestIdRef.current;
    busyRef.current = true;
    setLoading(true);
    setDialogOpen(false);
    try {
      const matches = await loadCompanies(start.payload, onlyLatest);
      if (requestId !== requestIdRef.current) return;
      const current = latestRef.current;
      if (!current.open || JSON.stringify(current.payload) !== JSON.stringify(start.payload)) {
        throw new Error('공고정보가 변경되었습니다. 현재 공고정보로 다시 불러와 주세요.');
      }
      const assignedKeys = new Set(current.groupAssignments.flat().filter(Boolean)
        .map((uid) => getRegionCompanyKey(current.participantMap.get(uid)?.candidate)).filter(Boolean));
      const existingByKey = new Map(current.candidates.map((candidate) => [getRegionCompanyKey(candidate), candidate]));
      const nextCandidates = current.candidates.slice();
      const keys = [];
      const importedIds = new Set();
      for (const candidate of matches) {
        const key = getRegionCompanyKey(candidate);
        if (assignedKeys.has(key)) continue;
        assignedKeys.add(key);
        const existing = existingByKey.get(key);
        const next = { ...(existing || candidate), [REGION_IMPORTED_FLAG]: true };
        if (existing) nextCandidates[nextCandidates.indexOf(existing)] = next;
        else nextCandidates.push(next);
        importedIds.add(next.id);
        keys.push(key);
      }
      if (!keys.length) {
        announce(matches.length ? '해당 업체는 모두 협정보드에 이미 배치되어 있습니다.' : '조건에 맞는 업체가 없습니다.');
        busyRef.current = false;
        setLoading(false);
        return;
      }
      setPendingKeys(keys);
      onUpdateBoard({ candidates: nextCandidates, excluded: current.excluded.filter((id) => !importedIds.has(id)) });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      busyRef.current = false;
      setLoading(false);
      announce(error.message || '업체를 불러오지 못했습니다.', 'error');
    }
  };

  return { dialogOpen, setDialogOpen, loading, importCompanies };
}
