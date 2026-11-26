import { useCallback, useEffect, useMemo, useRef } from 'react';
import { getRegionCompanyKey } from '../../../../shared/agreements/placement/regionImport.js';
import {
  openRegionSearch,
  subscribeRegionSearch,
  updateRegionSearchProps,
} from '../components/regionSearchStore.js';

export default function useBoardRegionSearch({ buildRegionSearchPayload, groupAssignments, participantMap }) {
  const sessionRef = useRef(null);
  const boardPlacedCompanyKeys = useMemo(() => {
    const keys = new Set();
    groupAssignments.forEach((group) => group.forEach((uid) => {
      const candidate = participantMap.get(uid)?.candidate;
      if (candidate) keys.add(getRegionCompanyKey(candidate));
    }));
    return [...keys];
  }, [groupAssignments, participantMap]);

  useEffect(() => subscribeRegionSearch((next) => {
    if (!next.open && next.props?.sessionId === sessionRef.current) {
      sessionRef.current = null;
    }
  }), []);

  useEffect(() => {
    if (sessionRef.current) {
      // Only refresh placement markers; preserve the popup's search conditions.
      updateRegionSearchProps({ boardPlacedCompanyKeys }, sessionRef.current);
    }
  }, [boardPlacedCompanyKeys]);

  return useCallback(() => {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionRef.current = sessionId;
    openRegionSearch({ ...buildRegionSearchPayload(), boardPlacedCompanyKeys, sessionId });
  }, [buildRegionSearchPayload, boardPlacedCompanyKeys]);
}
