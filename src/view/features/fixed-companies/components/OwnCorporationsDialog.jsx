import React from 'react';
import Modal from '../../../../components/Modal.jsx';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { FIXED_COMPANY_INDUSTRIES } from '../../../../shared/fixedCompanies.js';
import useFixedCompanies from '../hooks/useFixedCompanies.js';
import FixedCompanyTable from './FixedCompanyTable.jsx';
import './OwnCorporationsDialog.css';

export default function OwnCorporationsDialog({ initialIndustry, onClose }) {
  const { notify, confirm } = useFeedback();
  const state = useFixedCompanies({ notify, confirm, kind: 'own-corporations', initialIndustry });
  const { scope, companies, loading, saving, error } = state;
  const firstIndustryRef = React.useRef(null);
  const disabled = loading || saving || Boolean(error);
  const industryLabel = FIXED_COMPANY_INDUSTRIES.find((item) => item.value === scope.industry).label;
  const close = async () => {
    if (saving) return;
    if (state.dirtyCount && !await confirm({
      title: '우리 법인 설정을 닫을까요?',
      message: '저장하지 않은 변경사항이 있습니다. 닫으면 변경사항이 사라집니다.',
      confirmText: '닫기',
    })) return;
    onClose();
  };

  return (
    <>
      <Modal
        open={!state.pickerOpen}
        onClose={close}
        onSave={state.save}
        closeOnSave={false}
        confirmLabel={saving ? '저장 중…' : '설정 저장'}
        cancelLabel="닫기"
        confirmDisabled={disabled || !state.dirty}
        cancelDisabled={saving}
        disableEscClose={saving}
        initialFocusRef={firstIndustryRef}
        size="lg"
        maxWidth={1000}
        boxClassName="own-corporations-dialog"
        overlayClassName="own-corporations-overlay"
        ariaLabel="우리 법인 설정"
      >
        <header className="own-corporations-header">
          <span className="own-corporations-badge">우리 계열사</span>
          <h2>우리 법인</h2>
          <p>지역과 금액대에 관계없이, 공종별로 우리 계열사 법인을 관리합니다.</p>
        </header>
        <div className="own-corporations-toolbar">
          <div className="fixed-companies-segments" role="group" aria-label="우리 법인 공종">
            {FIXED_COMPANY_INDUSTRIES.map((industry, index) => (
              <button
                key={industry.value}
                ref={index === 0 ? firstIndustryRef : undefined}
                type="button"
                data-fixed-industry={industry.value}
                aria-pressed={scope.industry === industry.value}
                disabled={saving}
                onClick={() => state.setScope({ ...scope, industry: industry.value })}
              >{industry.label}</button>
            ))}
          </div>
          <button type="button" className="own-corporations-add" disabled={disabled} onClick={() => state.setPickerOpen(true)}>＋ 법인 추가</button>
        </div>
        <div className="own-corporations-summary">
          <strong>{industryLabel} 우리 법인 <span>{companies.length}</span></strong>
          <span role="status">{loading ? '불러오는 중…' : error ? '불러오기 실패' : state.dirty ? '저장하지 않은 변경사항이 있습니다.' : '저장된 설정입니다.'}</span>
        </div>
        {error ? (
          <div className="own-corporations-empty" role="alert"><p>{error}</p><button type="button" onClick={state.reload}>다시 시도</button></div>
        ) : loading ? (
          <div className="own-corporations-empty"><p>우리 법인 목록을 불러오고 있습니다.</p></div>
        ) : companies.length ? (
          <FixedCompanyTable companies={companies} disabled={saving} onNoteChange={state.updateNote} onRemove={state.removeCompany} />
        ) : (
          <div className="own-corporations-empty"><h3>{industryLabel}에 등록된 우리 법인이 없습니다.</h3><p>업체 검색으로 계열사를 추가하고 비고를 기록해 보세요.</p><button type="button" onClick={() => state.setPickerOpen(true)}>첫 법인 추가</button></div>
        )}
        <p className="own-corporations-hint">
          공종을 바꿔도 작성 중인 내용은 유지됩니다. ‘설정 저장’은 현재 공종에 적용됩니다.
          {state.dirtyCount > 1 && ` ${state.dirtyCount}개 공종에 저장할 변경사항이 있습니다.`}
        </p>
      </Modal>
      <div className="own-corporations-search">
        <CompanySearchModal open={state.pickerOpen} fileType={scope.industry} allowAll={false} forceWebSearch dedupeResults onClose={() => state.setPickerOpen(false)} onPick={state.pickCompany} />
      </div>
    </>
  );
}
