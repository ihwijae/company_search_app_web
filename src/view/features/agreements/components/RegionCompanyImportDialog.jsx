import React from 'react';
import Modal from '../../../../components/Modal.jsx';

export default function RegionCompanyImportDialog({ open, onClose, onImport }) {
  const [onlyLatest, setOnlyLatest] = React.useState(true);
  const latestRef = React.useRef(null);
  React.useEffect(() => {
    if (open) setOnlyLatest(true);
  }, [open]);
  React.useEffect(() => {
    if (!open) return undefined;
    // The board may render in another browser tab/window through a portal.
    const ownerDocument = latestRef.current?.ownerDocument;
    const dialog = latestRef.current?.closest('[role="dialog"]');
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
      if (event.key !== 'Tab' || !dialog) return;
      const controls = dialog.querySelectorAll('button:not([disabled]), input:not([disabled])');
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && ownerDocument.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && ownerDocument.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    ownerDocument?.addEventListener('keydown', handleKeyDown, true);
    return () => ownerDocument?.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  return (
    <Modal
      open={open}
      title="지역사불러오기"
      ariaLabel="지역사 불러오기 조건 선택"
      size="sm"
      initialFocusRef={latestRef}
      onClose={onClose}
      onSave={() => onImport(onlyLatest)}
      confirmLabel="불러오기"
    >
      <p>현재 공고정보를 기준으로 단독입찰이 불가능한 지역사를 불러옵니다.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <label>
          <input ref={latestRef} type="radio" name="region-import-scope" checked={onlyLatest} onChange={() => setOnlyLatest(true)} /> 최신업체만 불러오기
        </label>
        <label>
          <input type="radio" name="region-import-scope" checked={!onlyLatest} onChange={() => setOnlyLatest(false)} /> 모두 불러오기
        </label>
      </div>
      <p style={{ color: '#64748b', marginBottom: 0 }}>
        이미 배치된 업체는 제외하고, 빈 행의 첫 번째 구성사 자리에 지역사 한 곳씩 배치합니다. 대표사 자리는 비워둡니다. 부족한 행은 자동으로 추가합니다.
      </p>
    </Modal>
  );
}
