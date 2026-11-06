import React from 'react';
import Modal from '../../../../components/Modal.jsx';
import './RegionCompanyImportDialog.css';

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
      ariaLabel="지역사 불러오기 조건 선택"
      size="sm"
      overlayClassName="region-company-import-overlay"
      boxClassName="region-company-import-dialog"
      initialFocusRef={latestRef}
      onClose={onClose}
      onSave={() => onImport(onlyLatest)}
      confirmLabel="불러오기"
    >
      <header className="region-company-import__header">
        <h2>지역사 불러오기</h2>
        <p className="region-company-import__intro">
          현재 공고에서 단독입찰이 불가능한 지역사를 불러옵니다.
        </p>
      </header>
      <fieldset className="region-company-import__options">
        <legend>불러올 자료 선택</legend>
        <label className={`region-company-import__option${onlyLatest ? ' is-selected' : ''}`}>
          <input
            ref={latestRef}
            type="radio"
            name="region-import-scope"
            checked={onlyLatest}
            onChange={() => setOnlyLatest(true)}
          />
          <span className="region-company-import__option-content">
            <span className="region-company-import__option-title">최신업체만 불러오기</span>
            <span className="region-company-import__option-description">자료 상태가 ‘최신’인 업체만 불러옵니다.</span>
          </span>
        </label>
        <label className={`region-company-import__option${!onlyLatest ? ' is-selected' : ''}`}>
          <input
            type="radio"
            name="region-import-scope"
            checked={!onlyLatest}
            onChange={() => setOnlyLatest(false)}
          />
          <span className="region-company-import__option-content">
            <span className="region-company-import__option-title">모두 불러오기</span>
            <span className="region-company-import__option-description">자료의 최신 여부와 관계없이 불러옵니다.</span>
          </span>
        </label>
      </fieldset>
      <div className="region-company-import__notice">
        <strong>배치 안내</strong>
        <ul>
          <li>기존 배치는 유지하고, 이미 배치된 업체는 제외합니다.</li>
          <li>빈 행의 첫 번째 구성사 자리에 한 곳씩 배치합니다.</li>
          <li>대표사 자리는 비워두고, 부족한 행은 자동 추가합니다.</li>
        </ul>
      </div>
    </Modal>
  );
}
