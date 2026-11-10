import React from 'react';
import './CompanyImportDialog.css';

export default function CompanyImportDialog({ open, onClose, onRegionImport, onFixedImport, onOwnCorporationImport, onUndo, undoCount, lastImportTitle, disabled }) {
  const dialogRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const ownerDocument = dialog.ownerDocument;
    const previousFocus = ownerDocument.activeElement;
    dialog.querySelector('button:not([disabled])')?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key !== 'Tab') return;
      const buttons = dialog.querySelectorAll('button:not([disabled])');
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && ownerDocument.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && ownerDocument.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    ownerDocument.addEventListener('keydown', handleKeyDown, true);
    return () => {
      ownerDocument.removeEventListener('keydown', handleKeyDown, true);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const selectAction = (action) => {
    onClose();
    action();
  };
  const actions = [
    { title: '지역사 불러오기', description: '불러올 자료 조건을 선택해 지역사를 배치합니다.', onClick: onRegionImport },
    { title: '고정업체 불러오기', description: '등록된 고정업체를 협정보드에 배치합니다.', onClick: onFixedImport },
    { title: '우리법인 불러오기', description: '등록된 우리법인을 협정보드에 배치합니다.', onClick: onOwnCorporationImport },
  ];

  return (
    <div className="company-import-overlay" role="presentation" onClick={onClose}>
      <div ref={dialogRef} className="company-import-dialog" role="dialog" aria-modal="true" aria-label="업체 불러오기" onClick={(event) => event.stopPropagation()}>
        <header className="company-import-dialog__header">
          <h2>업체 불러오기</h2>
          <p>불러올 업체 종류를 선택해 주세요.</p>
        </header>
        <div className="company-import-dialog__options">
          {actions.map((action) => (
            <button key={action.title} type="button" className="company-import-dialog__option" disabled={disabled} onClick={() => selectAction(action.onClick)}>
              <strong>{action.title}</strong>
              <span>{action.description}</span>
            </button>
          ))}
        </div>
        <button type="button" className="company-import-dialog__undo" disabled={disabled || !undoCount} onClick={() => selectAction(onUndo)}>
          <strong>불러오기 되돌리기</strong>
          <span>{undoCount ? `최근 ${lastImportTitle} 취소 · ${undoCount}회 가능` : '되돌릴 불러오기 작업이 없습니다.'}</span>
        </button>
        <footer className="company-import-dialog__footer">
          <button type="button" onClick={onClose}>닫기</button>
        </footer>
      </div>
    </div>
  );
}
