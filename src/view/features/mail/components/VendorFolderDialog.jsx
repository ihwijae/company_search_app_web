import React from 'react';
import { createPortal } from 'react-dom';
import Modal from '../../../../components/Modal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { buildVendorFolderEntries } from '../services/vendorFolders.js';
import './VendorFolderDialog.css';

function FolderIcon({ close = false }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {close ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 2h18" />}
    </svg>
  );
}

export default function VendorFolderDialog({ folders, recipients, assignment, onClose }) {
  const { supported, directory, busy, progress, result } = folders;
  const { notify } = useFeedback();
  const [assignedOnly, setAssignedOnly] = React.useState(false);
  const [filterError, setFilterError] = React.useState('');
  const selectRef = React.useRef(null);
  const closeRef = React.useRef(null);
  const targetRecipients = assignedOnly ? assignment.recipients : recipients;
  const entries = buildVendorFolderEntries(targetRecipients);
  const canGenerate = supported && !busy && Boolean(directory) && entries.length > 0;
  const toggleAssignedOnly = () => {
    if (assignedOnly) {
      setAssignedOnly(false);
      setFilterError('');
      return;
    }
    setAssignedOnly(true);
    if (assignment.error) {
      setFilterError(assignment.error);
      notify({ type: 'warning', title: '작업 업체 확인', message: assignment.error, duration: 6000 });
      return;
    }
    setFilterError('');
  };
  const header = (
    <header className="mail-folder-dialog__header">
      <span className="mail-folder-dialog__icon"><FolderIcon /></span>
      <div>
        <span className="mail-folder-dialog__caption">메일 업무 도우미</span>
        <h2 id="mail-folder-dialog-title">업체별 폴더 생성</h2>
        <p>업체 목록에 맞춰 내 PC에 폴더를 한 번에 만드세요.</p>
      </div>
      <button ref={closeRef} type="button" className="mail-folder-dialog__close" aria-label="폴더 생성 창 닫기" onClick={onClose} disabled={busy}><FolderIcon close /></button>
    </header>
  );
  const footer = (
    <footer className="mail-folder-dialog__footer">
      <p>{busy ? '폴더 작업을 진행하고 있습니다.' : `${assignedOnly ? `${assignment.profileName || ''} 담당 업체` : '현재 업체 목록'} ${entries.length}개 기준`}</p>
      <div>
        <button type="button" className="mail-folder-dialog__button" onClick={onClose} disabled={busy}>닫기</button>
        <button type="button" className="mail-folder-dialog__button mail-folder-dialog__button--primary" onClick={() => folders.generate(targetRecipients)} disabled={!canGenerate || (assignedOnly && Boolean(assignment.error))}>
          {busy ? '처리 중…' : '폴더 생성'}
        </button>
      </div>
    </footer>
  );
  return createPortal(
    <Modal open onClose={onClose} ariaLabelledby="mail-folder-dialog-title" initialFocusRef={supported ? selectRef : closeRef} maxWidth={760} overlayClassName="mail-folder-overlay" boxClassName="mail-folder-dialog" disableEscClose={busy} header={header} footer={footer}>
      <div className="mail-folder-dialog__body" aria-busy={busy}>
        {supported ? (
          <>
            <section className="mail-folder-dialog__destination" aria-labelledby="mail-folder-destination-title">
              <div className="mail-folder-dialog__section-heading"><h3 id="mail-folder-destination-title">저장 위치</h3><span className={`mail-folder-dialog__badge${directory ? ' is-ready' : ''}`}>{directory ? '선택 완료' : '선택 필요'}</span></div>
              <div className="mail-folder-dialog__path">
                <span className="mail-folder-dialog__path-icon"><FolderIcon /></span>
                <div><strong>{directory ? directory.name : '공고명으로 만든 폴더를 선택하세요'}</strong><p>선택한 공고 폴더 안에 업체별 폴더가 생성됩니다.</p></div>
                <button ref={selectRef} type="button" className="mail-folder-dialog__button" onClick={folders.selectDirectory} disabled={busy}>{directory ? '변경' : '폴더 선택'}</button>
              </div>
            </section>

            <section aria-labelledby="mail-folder-preview-title">
              <div className="mail-folder-dialog__filter">
                <div><strong>{assignedOnly ? (assignment.error ? '담당 업체 확인 필요' : `${assignment.profileName} 담당 업체만 선택됨`) : '폴더 생성 대상'}</strong><p>{assignedOnly ? '현재 담당 업체의 폴더만 생성합니다.' : '불러온 SMTP 프로필 이름으로 담당 업체를 추릴 수 있습니다.'}</p></div>
                <button type="button" className="mail-folder-dialog__button" onClick={toggleAssignedOnly} disabled={busy} aria-pressed={assignedOnly}>{assignedOnly ? '전체 업체 보기' : '작업할 업체 폴더만 남기기'}</button>
              </div>
              {filterError && <div className="mail-folder-dialog__error mail-folder-dialog__filter-error" role="alert">{filterError}{!assignment.profileName && ' 이 창을 닫고 SMTP 프로필을 선택한 뒤 ‘불러오기’를 누르고 다시 시도해 주세요.'}</div>}
              <div className="mail-folder-dialog__section-heading"><h3 id="mail-folder-preview-title">생성할 폴더</h3><span className="mail-folder-dialog__count">총 {entries.length}개</span></div>
              <div className="mail-folder-dialog__preview">
                {entries.length ? entries.slice(0, 3).map((entry, index) => (
                  <div key={index}><FolderIcon /><span>{entry.name}</span></div>
                )) : <p>{assignedOnly ? '담당 업체를 확인한 뒤 폴더를 생성할 수 있습니다.' : '엑셀을 불러오거나 업체를 추가하면 여기에 표시됩니다.'}</p>}
                {entries.length > 3 && <p className="mail-folder-dialog__more">외 {entries.length - 3}개 업체 폴더</p>}
              </div>
              <p className="mail-folder-dialog__hint">번호는 업체 목록의 # 기준이며, 같은 이름의 폴더와 기존 파일은 유지합니다.</p>
            </section>

            <p className="mail-folder-dialog__hint">공고마다 저장 위치와 생성 대상을 확인한 뒤 ‘폴더 생성’을 눌러 주세요.</p>

            <div role="status" aria-live="polite">
              {busy && progress.total > 0 && (
                <div className="mail-folder-dialog__progress"><p>폴더 생성 중 <strong>{progress.processed} / {progress.total}</strong></p><progress value={progress.processed} max={progress.total} aria-label="폴더 생성 진행률" /></div>
              )}
              {!busy && result?.error && <div className="mail-folder-dialog__error">{result.error}</div>}
              {!busy && result && !result.error && (
                <div className="mail-folder-dialog__result">
                  <div><span>생성 완료</span><strong>{result.created}<small>개</small></strong></div>
                  <div><span>기존 폴더</span><strong>{result.existing}<small>개</small></strong></div>
                  <div><span>실패</span><strong>{result.failures.length}<small>개</small></strong></div>
                </div>
              )}
            </div>
            {result?.failures?.length > 0 && (
              <details className="mail-folder-dialog__error">
                <summary>생성하지 못한 폴더 확인</summary>
                <ul>{result.failures.map((failure, index) => <li key={index}>{failure.name}: {failure.message}</li>)}</ul>
              </details>
            )}
          </>
        ) : (
          <div className="mail-folder-dialog__notice"><h3>접속 환경을 확인해 주세요</h3><p>PC 폴더 생성은 Chrome 또는 Edge에서 HTTPS 또는 localhost로 접속할 때 사용할 수 있습니다.</p></div>
        )}
      </div>
    </Modal>,
    document.body,
  );
}
