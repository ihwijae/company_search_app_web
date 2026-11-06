import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import './FixedCompaniesPage.css';
import Sidebar from '../../../../components/Sidebar.jsx';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { FIXED_COMPANY_INDUSTRIES, FIXED_COMPANY_RANGES, FIXED_COMPANY_REGIONS } from '../../../../shared/fixedCompanies.js';
import useFixedCompanies from '../hooks/useFixedCompanies.js';
import FixedCompanyTable from '../components/FixedCompanyTable.jsx';

function PinIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 3 5 5-4 2-3 5-2 1-4-4 1-2 5-3 2-4Z" />
      <path d="m10 14-7 7M7 11l6 6" />
    </svg>
  );
}

export default function FixedCompaniesPage() {
  const { notify, confirm } = useFeedback();
  const state = useFixedCompanies({ notify, confirm });
  const { scope, setScope, loading, saving, error, companies } = state;
  const disabled = loading || saving || Boolean(error);
  const industryLabel = FIXED_COMPANY_INDUSTRIES.find((item) => item.value === scope.industry).label;
  const rangeLabel = FIXED_COMPANY_RANGES.find((item) => item.value === scope.range).label;
  const populatedRegions = FIXED_COMPANY_REGIONS.filter((region) => state.countForRegion(region) > 0).length;
  const selectMenu = async (key) => {
    if (key === 'fixed-companies') return;
    if (state.dirtyCount && !await confirm({ title: '다른 메뉴로 이동할까요?', message: '저장하지 않은 고정업체 변경사항이 있습니다. 이동하면 변경사항이 사라집니다.', confirmText: '이동' })) return;
    const routes = { 'agreements-sms': 'agreements' };
    window.location.hash = `#/${routes[key] || key}`;
  };

  return (
    <div className="app-shell">
      <Sidebar active="fixed-companies" onSelect={selectMenu} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <main className="stage fixed-companies-stage">
          <div className="fixed-companies-shell">
            <header className="fixed-companies-header">
              <div className="fixed-companies-heading">
                <span className="fixed-companies-heading__icon"><PinIcon /></span>
                <div>
                  <p className="fixed-companies-eyebrow">업체 관리</p>
                  <h1>고정업체 설정</h1>
                  <p className="fixed-companies-subtitle">공종과 금액대에 맞는 지역별 고정업체를 한곳에서 관리하세요.</p>
                </div>
              </div>
              <button type="button" className="fixed-companies-button fixed-companies-button--secondary" onClick={state.reload} disabled={loading || saving}>
                <span aria-hidden="true">↻</span> 다시 불러오기
              </button>
            </header>

            <section className="fixed-companies-filters" aria-label="고정업체 설정 조건">
              <fieldset>
                <legend><span>01</span> 공종</legend>
                <div className="fixed-companies-segments">
                  {FIXED_COMPANY_INDUSTRIES.map((item) => (
                    <button key={item.value} type="button" data-fixed-industry={item.value} aria-pressed={scope.industry === item.value} disabled={saving} onClick={() => setScope({ ...scope, industry: item.value })}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend><span>02</span> 금액대</legend>
                <div className="fixed-companies-segments">
                  {FIXED_COMPANY_RANGES.map((item) => (
                    <button key={item.value} type="button" aria-pressed={scope.range === item.value} disabled={saving} onClick={() => setScope({ ...scope, range: item.value })}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="fixed-companies-filter-summary">
                <span>현재 조건의 등록 지역</span>
                <strong>{populatedRegions}<small> / {FIXED_COMPANY_REGIONS.length}개 지역</small></strong>
              </div>
            </section>

            <div className="fixed-companies-workspace">
              <aside className="fixed-companies-regions" aria-label="지역 선택">
                <div className="fixed-companies-regions__heading"><h2><span>03</span> 지역</h2><span>등록 업체 수</span></div>
                <div className="fixed-companies-region-list">
                  {FIXED_COMPANY_REGIONS.map((region) => (
                    <button key={region} type="button" aria-pressed={scope.region === region} disabled={saving} onClick={() => setScope({ ...scope, region })}>
                      <span>{region}</span>
                      <span className="fixed-companies-region-count">{state.countForRegion(region)}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <section className="fixed-companies-list" aria-label="고정업체 목록" aria-busy={loading || saving}>
                <div className="fixed-companies-list__header">
                  <div>
                    <div className="fixed-companies-breadcrumb"><span className="fixed-companies-industry-label" data-fixed-industry={scope.industry}>{industryLabel}</span><span aria-hidden="true">/</span><span>{rangeLabel}</span></div>
                    <h2>{scope.region} 고정업체 <span>{companies.length}</span></h2>
                  </div>
                  <div className="fixed-companies-list__actions">
                    <button type="button" className="fixed-companies-button fixed-companies-button--secondary" onClick={() => state.setPickerOpen(true)} disabled={disabled}><span aria-hidden="true">＋</span> 업체 추가</button>
                    <button type="button" className="fixed-companies-button fixed-companies-button--primary" onClick={state.save} disabled={disabled || !state.dirty}>{saving ? '저장 중…' : '설정 저장'}</button>
                  </div>
                </div>
                <div className="fixed-companies-list__status" role="status">
                  <span className={`fixed-companies-save-status${state.dirty ? ' is-dirty' : ''}`}>
                    {loading ? '설정을 불러오는 중입니다.' : error ? '설정을 불러오지 못했습니다.' : state.dirty ? '저장하지 않은 변경사항이 있습니다.' : '저장된 설정입니다.'}
                  </span>
                  {state.dirtyCount > 1 && <span>{state.dirtyCount}개 조건에 저장할 변경사항이 있습니다.</span>}
                </div>

                {error ? (
                  <div className="fixed-companies-empty" role="alert"><h3>설정을 불러오지 못했습니다.</h3><p>{error}</p><button type="button" className="fixed-companies-button fixed-companies-button--secondary" onClick={state.reload}>다시 시도</button></div>
                ) : loading ? (
                  <div className="fixed-companies-empty"><span className="fixed-companies-empty__icon"><PinIcon /></span><p>고정업체 설정을 불러오고 있습니다.</p></div>
                ) : companies.length ? (
                  <FixedCompanyTable companies={companies} disabled={saving} onNoteChange={state.updateNote} onRemove={state.removeCompany} />
                ) : (
                  <div className="fixed-companies-empty">
                    <span className="fixed-companies-empty__icon"><PinIcon /></span>
                    <h3>{scope.region}에 등록된 고정업체가 없습니다.</h3>
                    <p>{industryLabel} · {rangeLabel} 조건에 사용할 업체를 추가해 주세요.<br />업체별 비고도 함께 기록할 수 있습니다.</p>
                    <button type="button" className="fixed-companies-button fixed-companies-button--primary" onClick={() => state.setPickerOpen(true)}>첫 고정업체 추가</button>
                  </div>
                )}
                <footer className="fixed-companies-list__footer"><span aria-hidden="true">ⓘ</span> 설정은 공종·금액대·지역별로 각각 저장됩니다. 조건을 바꿔도 작성 중인 내용은 유지됩니다.</footer>
              </section>
            </div>
          </div>
        </main>
      </div>
      <CompanySearchModal open={state.pickerOpen} fileType={scope.industry} allowAll={false} forceWebSearch dedupeResults onClose={() => state.setPickerOpen(false)} onPick={state.pickCompany} />
    </div>
  );
}
