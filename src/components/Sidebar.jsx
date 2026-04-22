import React from 'react';
import excelIcon from '../assets/excel.png';
import mmsIcon from '../assets/mms.png';
import emailIcon from '../assets/email.png';
import autoIcon from '../assets/auto.png';
import exchangeIcon from '../assets/교환.png';
import kakaoIcon from '../assets/kakao.png';
import notesIcon from '../assets/특이사항아이콘.png';
import { openTempCompaniesWindow } from '../utils/tempCompaniesWindow.js';

export default function Sidebar({ active, onSelect, fileStatuses, collapsed = true }) {
  const anyLoaded = !!(fileStatuses?.eung || fileStatuses?.tongsin || fileStatuses?.sobang);
  const [authMenuOpen, setAuthMenuOpen] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(() => {
    if (typeof window === 'undefined') return null;
    return window.__companySearchAuth?.user || null;
  });
  const accountMenuRef = React.useRef(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = () => {
      setCurrentUser(window.__companySearchAuth?.user || null);
    };
    window.addEventListener('company-search-auth-changed', sync);
    sync();
    return () => window.removeEventListener('company-search-auth-changed', sync);
  }, []);

  React.useEffect(() => {
    if (!authMenuOpen) return undefined;
    const onMouseDown = (event) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target)) {
        setAuthMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [authMenuOpen]);
  const handleSelect = (key) => {
    if (key === 'excel-web-edit' && typeof window !== 'undefined') {
      window.location.hash = '#/excel-web-edit';
      return;
    }
    if (key === 'agreements' && typeof window !== 'undefined') {
      const opener = window.__openAgreementBoard;
      if (typeof opener === 'function') {
        opener();
        return;
      }
    }
    if (key === 'temp-companies' && typeof window !== 'undefined') {
      try {
        openTempCompaniesWindow();
        return;
      } catch {}
    }
    if (onSelect) onSelect(key);
  };

  const navItems = [
    { key: 'search', label: '검색', icon: '🔍' },
    {
      key: 'company-notes',
      label: '업체별특이사항',
      icon: (
        <img
          src={notesIcon}
          alt="업체별특이사항"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    { key: 'records', label: '실적', icon: '📊' },
    {
      key: 'mail',
      label: '메일',
      icon: (
        <img
          src={emailIcon}
          alt="메일"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    {
      key: 'excel-helper',
      label: '엑셀도우미',
      icon: (
        <img
          src={excelIcon}
          alt="엑셀"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    { key: 'excel-web-edit', label: '엑셀수정(웹)', icon: '🧩' },
    {
      key: 'kakao-send',
      label: '카카오전송',
      icon: (
        <img
          src={kakaoIcon}
          alt="카카오전송"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    {
      key: 'agreements-sms',
      label: '협정 문자',
      icon: (
        <img
          src={mmsIcon}
          alt="협정 문자"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    {
      key: 'agreements',
      label: '협정보드',
      icon: '📋',
    },
    {
      key: 'auto-agreement',
      label: '협정 자동화',
      icon: (
        <img
          src={autoIcon}
          alt="협정 자동화"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    {
      key: 'bid-result',
      label: '개찰결과',
      icon: (
        <img
          src={exchangeIcon}
          alt="개찰결과"
          style={{ width: 22, height: 22, objectFit: 'contain' }}
        />
      ),
    },
    { key: 'temp-companies', label: '임시업체', icon: '🏢' },
    { key: 'upload', label: '업로드', icon: '📂' },
    { key: 'settings', label: '설정', icon: '⚙️' },
  ];

  const item = (key, label, icon) => (
    <div
      key={key}
      className={`nav-item ${active === key ? 'active' : ''}`}
      onClick={() => handleSelect(key)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(key); }}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {key === 'upload' && (
        <span className={`dot ${anyLoaded ? 'on' : ''}`} />
      )}
    </div>
  );

  return (
    <aside className={`sidebar top-nav ${collapsed ? 'collapsed' : 'expanded'}`}>
      <nav className="nav">
        <div className="nav-scroll">
          {navItems.map(({ key, label, icon }) => item(key, label, icon))}
        </div>
        <div className="nav-user" ref={accountMenuRef}>
          <button
            type="button"
            className="nav-user__button"
            onClick={() => setAuthMenuOpen((prev) => !prev)}
            title={currentUser?.id || ''}
          >
            {currentUser?.name || currentUser?.id || '사용자'}
          </button>
          {authMenuOpen ? (
            <div className="nav-user__panel">
              <button
                type="button"
                className="nav-user__logout"
                onClick={async () => {
                  const logout = window.__companySearchAuth?.logout;
                  if (typeof logout === 'function') {
                    await logout();
                  }
                }}
              >
                로그아웃
              </button>
            </div>
          ) : null}
        </div>
      </nav>
    </aside>
  );
}
