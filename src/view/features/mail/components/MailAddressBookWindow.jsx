import React from 'react';
import MailIcon from './MailIcon.jsx';
import './MailAddressBookWindow.css';

export default function MailAddressBookWindow({
  contacts, filteredContacts, loading, saving, dirty, targetId, selectedIds, query,
  fileInputRef, onQueryChange, onAdd, onImport, onExport, onSave, onApplySelected,
  onClose, onToggleSelection, onFieldChange, onApplyContact, onUseContact, onRemove,
}) {
  const picking = Boolean(targetId);
  return (
    <div className={`mail-addressbook-window mail-directory${picking ? ' is-picking' : ''}`}>
      <header className="mail-addressbook-window__header">
        <div className="mail-directory__heading">
          <span className="mail-directory__icon"><MailIcon name="addressBook" size={25} /></span>
          <div className="mail-addressbook-window__title">
            <span className="mail-directory__eyebrow">메일 발송 · 주소 관리</span>
            <div className="mail-directory__title-line"><h1>{picking ? '업체 담당자 선택' : '메일 주소록'}</h1><span className="mail-directory__total">{contacts.length}</span></div>
            <p>{picking ? '메일을 받을 담당자를 선택해 업체 목록에 추가하세요.' : '업체별 담당자와 이메일을 한곳에서 관리하세요.'}</p>
          </div>
        </div>
        <div className="mail-addressbook-window__toolbar">
          <button type="button" className="btn-sm btn-soft" onClick={onAdd} disabled={loading || saving}><MailIcon name="plus" size={16} />주소 추가</button>
          <button type="button" className="btn-sm btn-soft" onClick={() => fileInputRef.current?.click()} disabled={loading || saving}><MailIcon name="upload" size={15} />가져오기</button>
          <button type="button" className="btn-sm btn-soft" onClick={onExport} disabled={!contacts.length}><MailIcon name="download" size={15} />내보내기</button>
          <button type="button" className="btn-sm btn-primary" onClick={onSave} disabled={loading || saving || !dirty}><MailIcon name="save" size={15} />{saving ? '저장 중...' : '저장'}</button>
          {picking && <button type="button" className="btn-sm btn-primary" onClick={onApplySelected}><MailIcon name="check" size={15} />선택한 담당자 추가{selectedIds.length > 0 && <span className="mail-directory__selected-count">{selectedIds.length}</span>}</button>}
          <button type="button" className="btn-sm btn-muted mail-directory__close" onClick={onClose}><MailIcon name="close" size={15} />창 닫기</button>
        </div>
      </header>

      <section className="mail-addressbook-window__search" aria-label="주소록 검색">
        <label className="mail-directory__search-field">
          <MailIcon name="search" size={18} />
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="업체명, 담당자, 이메일 검색" aria-label="업체명, 담당자, 이메일 검색" />
          {query && <button type="button" onClick={() => onQueryChange('')} aria-label="검색어 지우기"><MailIcon name="close" size={15} /></button>}
        </label>
        <div className="mail-directory__search-meta" role="status">
          <span>{query.trim() ? '검색 결과' : '전체 주소록'} <strong>{filteredContacts.length}</strong>건</span>
          {picking && <span className="mail-directory__selection">선택 {selectedIds.length}건</span>}
          <span className={`mail-directory__save-state${dirty ? ' is-dirty' : ''}`}>{loading ? '불러오는 중' : saving ? '저장 중' : dirty ? '저장되지 않은 변경사항' : '변경사항 없음'}</span>
        </div>
        <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} />
      </section>

      <section className="mail-addressbook-window__table" aria-label="업체 담당자 주소록">
        <div className="mail-directory__grid">
          <div className="mail-addressbook-window__table-head">
            {picking && <span>선택</span>}
            <span>업체명</span><span>담당자</span><span>이메일</span><span>작업</span>
          </div>
          <div className="mail-addressbook-window__table-body">
            {filteredContacts.length ? filteredContacts.map((contact) => (
              <div key={contact.id} className={`mail-addressbook-window__row${picking && selectedIds.includes(contact.id) ? ' is-selected' : ''}`}>
                {picking && <label className="mail-addressbook-window__check"><input type="checkbox" checked={selectedIds.includes(contact.id)} onChange={() => onToggleSelection(contact.id)} aria-label={`${contact.vendorName || '업체'} ${contact.contactName || '담당자'} 선택`} /></label>}
                <div className="mail-directory__company"><span className="mail-directory__company-icon"><MailIcon name="building" size={18} /></span><input value={contact.vendorName} onChange={(event) => onFieldChange(contact.id, 'vendorName', event.target.value)} placeholder="업체명" aria-label="업체명" /></div>
                <input value={contact.contactName} onChange={(event) => onFieldChange(contact.id, 'contactName', event.target.value)} placeholder="담당자" aria-label="담당자" />
                <input className="mail-directory__email" value={contact.email} onChange={(event) => onFieldChange(contact.id, 'email', event.target.value)} placeholder="example@company.com" aria-label="이메일" />
                <div className="mail-addressbook-window__row-actions">
                  <button type="button" className="btn-sm btn-soft" onClick={() => picking ? onApplyContact(targetId, contact) : onUseContact(contact)}><MailIcon name="plus" size={14} />{picking ? '1명 추가' : '추가'}</button>
                  <button type="button" className="btn-sm btn-muted mail-directory__remove" onClick={() => onRemove(contact.id)} aria-label={`${contact.vendorName || '업체'} ${contact.contactName || '담당자'} 삭제`} title="주소 삭제"><MailIcon name="trash" size={15} /></button>
                </div>
              </div>
            )) : (
              <div className="mail-addressbook-window__empty">
                <span className="mail-directory__empty-icon"><MailIcon name={query.trim() ? 'search' : 'addressBook'} size={29} /></span>
                <strong>{loading ? '주소록을 불러오고 있습니다' : query.trim() ? '검색 결과가 없습니다' : '아직 등록된 주소가 없습니다'}</strong>
                <p>{loading ? '잠시만 기다려 주세요.' : query.trim() ? '다른 업체명이나 담당자 이름으로 검색해 보세요.' : '‘주소 추가’ 또는 ‘가져오기’로 담당자를 등록하세요.'}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="mail-directory__footer">
        <span><MailIcon name="profile" size={15} />목록에서 업체명과 담당자 정보를 바로 수정할 수 있습니다.</span>
        <span>{dirty ? '변경한 내용은 상단의 저장 버튼으로 반영하세요.' : picking ? '담당자를 체크한 뒤 선택한 담당자 추가를 눌러 주세요.' : `총 ${contacts.length}건의 주소록`}</span>
      </footer>
    </div>
  );
}
