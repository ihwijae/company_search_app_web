export const REGION_IMPORTED_FLAG = '_agreementRegionImported';

export function getRegionCompanyKey(candidate) {
  if (!candidate) return '';
  const snapshot = candidate.snapshot || {};
  const bizNo = String(candidate.bizNo || candidate['사업자번호'] || snapshot.bizNo || snapshot['사업자번호'] || '').replace(/\D/g, '');
  if (bizNo) return `biz:${bizNo}`;
  const name = String(candidate.name || candidate['검색된 회사'] || candidate['업체명'] || snapshot['검색된 회사'] || snapshot['업체명'] || '').replace(/\s+/g, '').toLowerCase();
  return name ? `name:${name}` : `id:${candidate.id}`;
}

// One regional company per empty agreement row; leave the leader position free.
export function placeRegionEntries(assignments, entries, groupSize) {
  if (groupSize < 2) throw new Error('지역사를 배치할 구성사 자리가 없습니다.');
  const next = assignments.map((row) => row.slice());
  const used = new Set(next.flat().filter(Boolean));
  const slotIndex = 1;
  let rowIndex = 0;
  let placedCount = 0;
  const previousCount = next.length;
  for (const entry of entries) {
    if (used.has(entry.uid)) continue;
    while (rowIndex < next.length && next[rowIndex].some(Boolean)) rowIndex += 1;
    if (rowIndex === next.length) next.push(Array(groupSize).fill(null));
    next[rowIndex][slotIndex] = entry.uid;
    used.add(entry.uid);
    rowIndex += 1;
    placedCount += 1;
  }
  return { assignments: next, placedCount, addedRows: next.length - previousCount };
}
