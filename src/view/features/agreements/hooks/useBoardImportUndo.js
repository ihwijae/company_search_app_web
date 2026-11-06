import React from 'react';
import { IMPORT_UNDO_SLOT_FIELDS, undoBoardImport } from '../../../../shared/agreements/placement/boardImportUndo.js';

const MAX_HISTORY = 20;

export default function useBoardImportUndo(options) {
  const { open, resetKey } = options;
  const latestRef = React.useRef(options);
  latestRef.current = options;
  const stackRef = React.useRef([]);
  const [history, setHistory] = React.useState([]);
  const clear = React.useCallback(() => {
    stackRef.current = [];
    setHistory([]);
  }, []);
  React.useEffect(() => { clear(); }, [open, resetKey, clear]);

  const recordImport = React.useCallback((transaction) => {
    const current = latestRef.current;
    const beforeSlotValues = Object.fromEntries(IMPORT_UNDO_SLOT_FIELDS.map((field) => [
      field, current[field].map((row) => Array.isArray(row) ? row.slice() : []),
    ]));
    stackRef.current = [...stackRef.current, { ...transaction, beforeSlotValues }].slice(-MAX_HISTORY);
    setHistory(stackRef.current);
  }, []);

  const undo = () => {
    const current = latestRef.current;
    if (!current.open || !stackRef.current.length) return;
    const transaction = stackRef.current[stackRef.current.length - 1];
    const result = undoBoardImport(current, transaction);
    stackRef.current = stackRef.current.slice(0, -1);
    setHistory(stackRef.current);
    current.markSkipAssignmentSync();
    current.setGroupAssignments(result.groupAssignments);
    for (const field of IMPORT_UNDO_SLOT_FIELDS) current.setters[field](result[field]);
    current.setters.groupApprovals(result.groupApprovals);
    current.setters.groupManagementBonus(result.groupManagementBonus);
    current.onUpdateBoard({ candidates: result.candidates, excluded: result.excluded });
    current.onUndoApplied(result);
    current.notify({
      title: '불러오기 되돌리기',
      message: `${transaction.title}를 취소했습니다. 업체 ${result.removedCount}개${result.removedRows ? `, 빈 행 ${result.removedRows}개` : ''}를 정리했습니다.`,
      portalTarget: current.portalContainer || null,
    });
  };
  return { recordImport, clear, undo, count: history.length, lastTitle: history[history.length - 1]?.title || '' };
}
