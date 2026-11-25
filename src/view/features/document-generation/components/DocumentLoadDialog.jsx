import React, { useMemo, useRef, useState } from 'react';
import Modal from '../../../../components/Modal.jsx';
import { AGREEMENT_GROUPS, getDocumentRangeOptions } from '../../../../shared/navigation.js';
import { INDUSTRIES } from '../documentForm.js';
import './DocumentLoadDialog.css';

function LibraryIcon({ type = 'file' }) {
  const paths = {
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 11-1l3 3M4 15l3 3a7 7 0 0 0 11-1" /></>,
    trash: <><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

const ownerLabel = (id) => AGREEMENT_GROUPS.find((group) => group.ownerId === id)?.label || '발주처 미선택';
const industryLabel = (value) => INDUSTRIES.find((industry) => industry.value === value)?.label || '공종 미선택';
const reviewLabel = (value) => value === 'qualification' ? '적격심사' : '종합심사';
const rangeLabel = (document) => getDocumentRangeOptions(document.ownerId, document.reviewType).find((range) => range.key === document.rangeId)?.label || '금액대 미선택';
const formatDate = (value, withTime = false) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '미입력';
  return withTime
    ? date.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

function DocumentPreview({ document }) {
  if (!document) return <aside className="document-library-preview document-library-preview--empty"><span className="document-library-preview__empty-icon"><LibraryIcon /></span><h3>문서를 선택해 주세요</h3><p>목록에서 문서를 선택하면<br />공고와 참여업체를 확인할 수 있습니다.</p></aside>;
  return (
    <aside className="document-library-preview" aria-label="선택한 문서 요약" aria-live="polite">
      <span className="document-library-caption">선택한 문서</span>
      <span className="document-library-preview__icon"><LibraryIcon /></span>
      <h3>{document.title}</h3>
      <div className="document-library-tags"><span>{reviewLabel(document.reviewType)}</span><span>{industryLabel(document.industry)}</span><span>{rangeLabel(document)}</span></div>
      <dl className="document-library-facts"><div><dt>발주처</dt><dd>{ownerLabel(document.ownerId)}</dd></div><div><dt>공고번호</dt><dd>{document.noticeNo || '미입력'}</dd></div><div><dt>공고명</dt><dd>{document.noticeTitle || '미입력'}</dd></div><div><dt>작성날짜</dt><dd>{document.writtenDate || '미입력'}</dd></div><div><dt>최종 저장</dt><dd>{formatDate(document.updatedAt, true)}</dd></div></dl>
      <div className="document-library-preview__companies"><strong>참여업체 <span>{document.companyCount}개사</span></strong><p>{document.companyNames.length ? document.companyNames.join(' · ') : '업체 미선택'}</p></div>
      <div className="document-library-tip">저장 당시의 정보로 불러옵니다. 수정 후 새 문서로 저장하면 이전 제출 내용도 보관할 수 있습니다.</div>
    </aside>
  );
}

export default function DocumentLoadDialog({ library, currentId }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const inputRef = useRef(null);
  const operating = Boolean(library.openingId || library.deletingId);
  const busy = library.loading || operating;
  const filtered = useMemo(() => {
    const token = query.trim().toLocaleLowerCase();
    return library.documents.filter((document) => [document.title, document.noticeNo, document.noticeTitle, ...document.companyNames].join(' ').toLocaleLowerCase().includes(token));
  }, [library.documents, query]);
  const selected = filtered.find((document) => document.id === selectedId);
  const canLoad = !busy && Boolean(selected) && !library.error;
  const header = <header className="document-library-header"><div className="document-library-header__icon"><LibraryIcon type="folder" /></div><div><span className="document-library-caption">제출서류 보관함</span><h2 id="document-library-title">저장된 서류 불러오기</h2><p>이전에 작성한 서류를 찾아 이어서 작업하세요.</p></div><button type="button" className="document-library-close" aria-label="불러오기 닫기" onClick={library.closeLibrary} disabled={operating}><LibraryIcon type="close" /></button></header>;
  const footer = <footer className="document-library-footer"><div className="document-library-footer__selection"><span className={selected ? 'is-selected' : ''}><LibraryIcon type={selected ? 'check' : 'file'} /></span><div><strong>{selected ? '문서 1개 선택됨' : '불러올 문서를 선택해 주세요'}</strong>{selected && <small>{selected.title}</small>}</div></div><div className="document-library-footer__actions"><button type="button" className="document-library-button document-library-button--danger" disabled={!canLoad} onClick={() => canLoad && library.remove(selected)}><LibraryIcon type="trash" />{library.deletingId ? '삭제 중…' : '선택한 서류 삭제'}</button><button type="button" className="document-library-button document-library-button--secondary" onClick={library.closeLibrary} disabled={operating}>취소</button><button type="button" className="document-library-button document-library-button--primary" onClick={() => canLoad && library.load(selected.id)} disabled={!canLoad}>{library.openingId ? '불러오는 중…' : '선택한 서류 불러오기'}</button></div></footer>;
  return (
    <Modal open onClose={library.closeLibrary} ariaLabelledby="document-library-title" initialFocusRef={inputRef} disableEscClose={operating} maxWidth={1100} overlayClassName="document-library-overlay" boxClassName="document-library-dialog" contentClassName="document-library-content" header={header} footer={footer}>
      <div className="document-library-layout">
        <section className="document-library-browser" aria-label="문서 검색 및 목록">
          <div className="document-library-toolbar"><label className="document-library-searchbox"><LibraryIcon type="search" /><input ref={inputRef} aria-label="저장된 서류 검색" value={query} disabled={operating} onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }} placeholder="저장 이름, 공고번호, 공고명, 업체명 검색" /></label><button type="button" className="document-library-refresh" onClick={library.reload} disabled={busy} aria-label="문서 목록 새로고침" title="새로고침"><LibraryIcon type="refresh" /></button></div>
          <div className="document-library-list-heading"><p role="status">저장된 문서 <strong>{filtered.length}</strong>건</p><span>최근 저장순</span></div>
          <div className="document-library-results" aria-busy={library.loading}>
            {library.error ? <div className="document-library-state document-library-state--error" role="alert"><span className="document-library-state__icon"><LibraryIcon /></span><h3>서류를 불러오지 못했습니다</h3><p>{library.error}</p><button type="button" className="document-library-button document-library-button--secondary" onClick={library.reload} disabled={busy}>다시 시도</button></div>
              : library.loading ? <div className="document-library-state" role="status"><span className="document-library-spinner" /><p>저장된 서류를 불러오고 있습니다.</p></div>
                : filtered.length ? <div className="document-library-cards" role="group" aria-label="저장된 서류 목록">{filtered.map((document) => <button type="button" className="document-library-card" aria-pressed={selectedId === document.id} key={document.id} disabled={busy} onClick={() => setSelectedId(document.id)}>
                  <span className="document-library-card__icon"><LibraryIcon /></span>
                  <span className="document-library-card__body"><span className="document-library-card__top"><span className="document-library-card__review">{reviewLabel(document.reviewType)}</span>{currentId === document.id && <span className="document-library-card__current">현재 문서</span>}</span><strong className="document-library-card__title">{document.title}</strong><span className="document-library-card__notice">{document.noticeNo || '공고번호 미입력'} · {document.noticeTitle || '공고명 미입력'}</span><span className="document-library-card__meta">{ownerLabel(document.ownerId)} · {industryLabel(document.industry)} · {document.companyCount}개사<span>{formatDate(document.updatedAt)}</span></span></span>
                  <span className="document-library-card__check">{selectedId === document.id && <LibraryIcon type="check" />}</span>
                </button>)}</div>
                  : <div className="document-library-state"><span className="document-library-state__icon"><LibraryIcon type={query.trim() ? 'search' : 'folder'} /></span><h3>{query.trim() ? '검색 결과가 없습니다' : '아직 저장된 서류가 없습니다'}</h3><p>{query.trim() ? '다른 공고명이나 업체명으로 검색해 보세요.' : '작성 화면에서 저장하면 이곳에서 다시 열 수 있습니다.'}</p>{query.trim() && <button type="button" className="document-library-button document-library-button--secondary" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>검색 초기화</button>}</div>}
          </div>
        </section>
        <DocumentPreview document={selected} />
      </div>
    </Modal>
  );
}
