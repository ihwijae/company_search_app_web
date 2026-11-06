import { REGION_IMPORTED_FLAG } from './regionImport.js';

export const IMPORT_UNDO_SLOT_FIELDS = [
  'groupShares', 'groupShareRawInputs', 'groupCredibility',
  'groupTechnicianScores', 'groupQualityScores',
];

const cloneMatrix = (matrix = []) => matrix.map((row) => Array.isArray(row) ? row.slice() : []);
const hasValue = (value) => value !== undefined && value !== null && value !== '' && value !== false && value !== 0;

// Reverse the import's changes rather than replacing the whole board snapshot.
export function undoBoardImport(current, transaction) {
  const beforeAssigned = new Set(transaction.beforeAssignments.flat().filter(Boolean));
  const importedUids = new Set(transaction.afterAssignments.flat().filter((uid) => uid && !beforeAssigned.has(uid)));
  const assignments = cloneMatrix(current.groupAssignments);
  const slotValues = Object.fromEntries(IMPORT_UNDO_SLOT_FIELDS.map((field) => [field, cloneMatrix(current[field])]));
  let removedCount = 0;
  const removedUids = new Set();
  assignments.forEach((row, groupIndex) => row.forEach((uid, slotIndex) => {
    if (!importedUids.has(uid)) return;
    row[slotIndex] = null;
    removedUids.add(uid);
    removedCount += 1;
    for (const field of IMPORT_UNDO_SLOT_FIELDS) {
      if (!slotValues[field][groupIndex]) slotValues[field][groupIndex] = [];
      // Restore values that existed in an empty slot before the import.
      slotValues[field][groupIndex][slotIndex] = !transaction.beforeAssignments[groupIndex]?.[slotIndex]
        ? (transaction.beforeSlotValues?.[field]?.[groupIndex]?.[slotIndex] ?? '') : '';
    }
  }));

  // Trim only the import's trailing rows, retaining rows added or edited later.
  const beforeRowCount = transaction.beforeAssignments.length;
  if (assignments.length === transaction.afterAssignments.length) {
    while (assignments.length > beforeRowCount) {
      const index = assignments.length - 1;
      if (assignments[index].some(Boolean)
        || hasValue(current.groupApprovals?.[index])
        || hasValue(current.groupManagementBonus?.[index])
        || IMPORT_UNDO_SLOT_FIELDS.some((field) => slotValues[field][index]?.some(hasValue))) break;
      assignments.pop();
    }
  }
  const rowCount = assignments.length;
  for (const field of IMPORT_UNDO_SLOT_FIELDS) slotValues[field] = slotValues[field].slice(0, rowCount);

  const remainingCandidateIds = new Set(assignments.flat().filter(Boolean)
    .map((uid) => current.participantMap.get(uid)?.candidate?.id).filter(Boolean));
  const beforeCandidates = new Map(transaction.beforeCandidates.map((candidate) => [candidate.id, candidate]));
  const afterCandidates = new Map(transaction.afterCandidates.map((candidate) => [candidate.id, candidate]));
  const candidates = current.candidates.filter((candidate) => (
    beforeCandidates.has(candidate.id) || !afterCandidates.has(candidate.id)
    || remainingCandidateIds.has(candidate.id) || candidate._agreementCandidateListed === true
  )).map((candidate) => {
    const before = beforeCandidates.get(candidate.id);
    const after = afterCandidates.get(candidate.id);
    if (!before || !after || remainingCandidateIds.has(candidate.id)
      || before[REGION_IMPORTED_FLAG] === after[REGION_IMPORTED_FLAG]
      || candidate[REGION_IMPORTED_FLAG] !== after[REGION_IMPORTED_FLAG]) return candidate;
    const restored = { ...candidate };
    if (Object.prototype.hasOwnProperty.call(before, REGION_IMPORTED_FLAG)) restored[REGION_IMPORTED_FLAG] = before[REGION_IMPORTED_FLAG];
    else delete restored[REGION_IMPORTED_FLAG];
    return restored;
  });
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const removedCandidateIds = new Set(current.candidates.filter((candidate) => !candidateIds.has(candidate.id)).map((candidate) => candidate.id));
  const excluded = new Set(current.excluded.filter((id) => !removedCandidateIds.has(id)));
  const afterExcluded = new Set(transaction.afterExcluded);
  for (const id of transaction.beforeExcluded) {
    if (!afterExcluded.has(id) && candidateIds.has(id) && !remainingCandidateIds.has(id)) excluded.add(id);
  }
  return {
    groupAssignments: assignments,
    ...slotValues,
    groupApprovals: current.groupApprovals.slice(0, rowCount),
    groupManagementBonus: current.groupManagementBonus.slice(0, rowCount),
    candidates,
    excluded: [...excluded],
    removedCount,
    removedRows: current.groupAssignments.length - rowCount,
    removedUids,
  };
}
