import React from 'react';

export default function BoardSearchPopup({
  field,
  onFieldChange,
  query,
  onQueryChange,
  matches,
  activeKey,
  currentLabel,
  inputRef,
  onClose,
  onMove,
  onSelect,
}) {
  return (
    <div className="excel-board-search-overlay" onClick={onClose}>
      <div className="excel-board-search-modal" onClick={(event) => event.stopPropagation()}>
        <div className="excel-board-search-modal-header">
          <strong>찾기</strong>
          <button type="button" className="excel-board-search-close" onClick={onClose}>닫기</button>
        </div>
        <div className="excel-board-search-box">
          <select
            className="input"
            aria-label="검색 기준"
            value={field}
            onChange={(event) => onFieldChange(event.target.value === 'manager' ? 'manager' : 'name')}
          >
            <option value="name">업체명</option>
            <option value="manager">담당자명</option>
          </select>
          <input
            ref={inputRef}
            className="input"
            aria-label="검색어"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="검색어 입력 (Ctrl+F)"
          />
          <span className="excel-board-search-status" role="status">{currentLabel}</span>
          <button type="button" className="excel-btn" onClick={() => onMove(-1)} disabled={!matches.length}>이전</button>
          <button type="button" className="excel-btn" onClick={() => onMove(1)} disabled={!matches.length}>다음</button>
        </div>
        {query.trim() && (
          matches.length > 0 ? (
            <ul className="excel-board-search-results" aria-label="검색 결과">
              {matches.map((match, index) => (
                <li key={match.key}>
                  <button
                    type="button"
                    className={`excel-board-search-result${match.key === activeKey ? ' active' : ''}`}
                    aria-current={match.key === activeKey ? 'true' : undefined}
                    onClick={() => onSelect(index)}
                  >
                    <span className="excel-board-search-result-company">{match.companyName || '업체명 없음'}</span>
                    <span className="excel-board-search-result-manager">담당자: {match.managerName || '미지정'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="excel-board-search-empty">검색 결과가 없습니다.</p>
          )
        )}
      </div>
    </div>
  );
}
