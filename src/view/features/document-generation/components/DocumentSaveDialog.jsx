import React, { useRef, useState } from 'react';
import Modal from '../../../../components/Modal.jsx';
import { AGREEMENT_GROUPS, getDocumentRangeOptions } from '../../../../shared/navigation.js';
import { INDUSTRIES } from '../documentForm.js';
import './DocumentLoadDialog.css';
import './DocumentSaveDialog.css';

function SaveIcon({ type = 'save' }) {
  const paths = {
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z" /><path d="M7 3v6h10V3M7 21v-8h10v8" /></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg>;
}

export default function DocumentSaveDialog({ record, form, saving, error, onSave, onClose }) {
  const inputRef = useRef(null);
  const [title, setTitle] = useState(record?.title || [form.noticeTitle || form.noticeNo || '제목 없는 서류', form.writtenDate].filter(Boolean).join(' · '));
  const [asNew, setAsNew] = useState(!record);
  const canSave = !saving && Boolean(title.trim());
  const saveLabel = record ? (asNew ? '새 문서로 저장' : '현재 문서에 저장') : '저장';
  const save = () => { if (canSave) onSave(title.trim(), asNew); };
  const owner = AGREEMENT_GROUPS.find((group) => group.ownerId === form.ownerId)?.label || '발주처 미선택';
  const industry = INDUSTRIES.find((item) => item.value === form.industry)?.label;
  const rangeLabel = getDocumentRangeOptions(form.ownerId, form.reviewType).find((range) => range.key === form.rangeId)?.label;
  const header = <header className="document-library-header"><span className="document-library-header__icon"><SaveIcon /></span><div><span className="document-library-caption">제출서류 보관함</span><h2 id="document-save-title">서류 입력정보 저장</h2><p>작성한 내용을 보관하고, 필요할 때 다시 이어서 작업하세요.</p></div><button type="button" className="document-library-close" aria-label="저장 창 닫기" onClick={onClose} disabled={saving}><SaveIcon type="close" /></button></header>;
  const footer = <footer className="document-library-footer document-save-footer"><p role="status">{saving ? '입력정보를 저장하고 있습니다.' : '공고와 업체별 입력정보를 함께 저장합니다.'}</p><div className="document-library-footer__actions"><button type="button" className="document-library-button document-library-button--secondary" disabled={saving} onClick={onClose}>취소</button><button type="button" className="document-library-button document-library-button--primary" disabled={!canSave} onClick={save}>{saving ? '저장 중…' : saveLabel}</button></div></footer>;
  return (
    <Modal open onClose={onClose} ariaLabelledby="document-save-title" initialFocusRef={inputRef} maxWidth={760} overlayClassName="document-library-overlay" boxClassName="document-library-dialog document-save-dialog" disableEscClose={saving} header={header} footer={footer}>
      <div className="document-save-body">
        <section className="document-save-overview" aria-label="저장할 공고 요약"><div className="document-library-tags"><span>{form.reviewType === 'qualification' ? '적격심사' : '종합심사'}</span><span>{industry}</span><span>{rangeLabel || '금액대 미선택'}</span><span>{form.companyCount}개사</span></div><h3>{form.noticeTitle || '공고명 미입력'}</h3><p>{owner} · {form.noticeNo || '공고번호 미입력'}</p></section>
        <label className="document-save-name"><span>저장 이름</span><input ref={inputRef} value={title} maxLength={200} disabled={saving} onChange={(event) => setTitle(event.target.value)} placeholder="서류를 구분할 이름을 입력해 주세요" aria-describedby="document-save-name-hint" /><small id="document-save-name-hint">공고명이나 제출일을 넣으면 나중에 쉽게 찾을 수 있습니다.</small></label>
        {record && <fieldset className="document-save-modes" disabled={saving}><legend>저장 방식</legend><div className="document-save-modes__grid"><label className={`document-save-mode${!asNew ? ' is-active' : ''}`}><input type="radio" name="document-save-mode" checked={!asNew} onChange={() => setAsNew(false)} /><span className="document-save-mode__icon"><SaveIcon /></span><span className="document-save-mode__text"><strong>현재 문서에 저장</strong><small>불러온 문서를 수정한 내용으로<br />업데이트합니다.</small></span></label><label className={`document-save-mode${asNew ? ' is-active' : ''}`}><input type="radio" name="document-save-mode" checked={asNew} onChange={() => setAsNew(true)} /><span className="document-save-mode__icon"><SaveIcon type="copy" /></span><span className="document-save-mode__text"><strong>새 문서로 저장</strong><small>기존 제출 내용은 보관하고<br />별도의 문서로 저장합니다.</small></span></label></div></fieldset>}
        {record && <p className="document-save-mode-hint">{asNew ? '기존 문서는 그대로 유지되며, 문서가 새로 추가됩니다.' : `‘${record.title}’ 문서의 저장 내용을 변경합니다.`}</p>}
        {error && <div className="document-save-error" role="alert"><strong>저장하지 못했습니다</strong><p>{error}</p></div>}
      </div>
    </Modal>
  );
}
