import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import './DocumentGenerationPage.css';
import Sidebar from '../../../../components/Sidebar.jsx';
import AmountInput from '../../../../components/AmountInput.jsx';
import CompanySearchModal from '../../../../components/CompanySearchModal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { AGREEMENT_GROUPS, getDocumentRangeOptions } from '../../../../shared/navigation.js';
import { INDUSTRIES, getShareSummary } from '../documentForm.js';
import useDocumentForm from '../hooks/useDocumentForm.js';
import DocumentField from '../components/DocumentField.jsx';
import CompanyDocumentCard from '../components/CompanyDocumentCard.jsx';
import useDocumentLibrary from '../hooks/useDocumentLibrary.js';
import DocumentSaveDialog from '../components/DocumentSaveDialog.jsx';
import DocumentLoadDialog from '../components/DocumentLoadDialog.jsx';
import MajorMaterialsDialog from '../components/MajorMaterialsDialog.jsx';
import useDocumentExperience from '../hooks/useDocumentExperience.js';
import DocumentExperienceStatus from '../components/DocumentExperienceStatus.jsx';
import useLhApplication from '../hooks/useLhApplication.js';
import LhApplicationPreview from '../components/LhApplicationPreview.jsx';
import useLhOverview from '../hooks/useLhOverview.js';

function DocumentIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>;
}

export default function DocumentGenerationPage() {
  const [materialsOpen, setMaterialsOpen] = React.useState(false);
  const [applicationOpen, setApplicationOpen] = React.useState(false);
  const [previewPage, setPreviewPage] = React.useState(1);
  const feedback = useFeedback();
  const state = useDocumentForm(feedback);
  const library = useDocumentLibrary({ state, ...feedback });
  const editingBusy = library.saving || state.managementLoadingIndex !== null;
  const { form, update } = state;
  const experience = useDocumentExperience(form, state.record);
  const application = useLhApplication(form, state.record);
  const overview = useLhOverview(form, state.record, application, experience.snapshot);
  const rangeOptions = getDocumentRangeOptions(form.ownerId, form.reviewType);
  const selectedRange = rangeOptions.find((range) => range.key === form.rangeId);
  const companies = form.companies.slice(0, form.companyCount);
  const shares = getShareSummary(companies);
  const owner = AGREEMENT_GROUPS.find((group) => group.ownerId === form.ownerId);
  const selectedCount = companies.filter((company) => company.name).length;
  const qualification = form.reviewType === 'qualification';
  const input = (key, placeholder, type = 'text') => <input type={type} value={form[key]} placeholder={placeholder} onChange={(event) => update(key, event.target.value)} />;

  return (
    <div className="app-shell document-app">
      <Sidebar active="document-generation" onSelect={(key) => { window.location.hash = `#/${({ agreements: 'agreement-board', 'agreements-sms': 'agreements' })[key] || key}`; }} />
      <div className="main">
        <div className="title-drag" /><div className="topbar" />
        <main className="stage document-stage">
          <div className="document-shell">
            <header className="document-heading">
              <div className="document-heading__title"><span className="document-heading__icon"><DocumentIcon /></span><div><p className="document-eyebrow">낙찰 후 제출서류</p><h1>서류생성</h1><p>공고와 참여업체 정보를 모아, 서류 작성을 간편하게.</p></div></div>
              <div className="document-heading__actions">
                <button type="button" className="document-button document-button--secondary" onClick={() => setMaterialsOpen(true)} disabled={editingBusy}>주요자재</button>
                <button type="button" className="document-button document-button--secondary" onClick={state.reset} disabled={editingBusy}>새로 작성</button>
                <button type="button" className="document-button document-button--secondary" onClick={library.openLibrary} disabled={editingBusy}>불러오기</button>
                <button type="button" className="document-button document-button--primary" onClick={library.openSave} disabled={editingBusy}>{library.saving ? '저장 중…' : '저장'}</button>
              </div>
            </header>

            <div className="document-save-status" role="status"><strong>{state.record?.title || '새 문서'}</strong><span>{state.dirty ? '저장하지 않은 변경사항이 있습니다.' : state.record ? `서버에 저장됨 · ${new Date(state.record.updatedAt).toLocaleString('ko-KR')}` : '작성한 내용은 저장 버튼으로 보관할 수 있습니다.'}</span></div>
            <fieldset className="document-edit-area" disabled={editingBusy} aria-label="서류 입력정보">
            <section className="document-review" aria-label="심사유형 선택">
              <div><h2>어떤 서류를 준비하시나요?</h2><p>심사유형에 맞춰 작성할 정보를 입력하세요.</p></div>
              <div className="document-review__choices">
                <button type="button" aria-pressed={qualification} onClick={() => update('reviewType', 'qualification')}><span className="document-choice__radio" /><span><strong>적격심사</strong><small>적격심사 제출서류</small></span><span className="document-choice__badge">입력 가능</span></button>
                <button type="button" aria-pressed={!qualification} onClick={() => update('reviewType', 'comprehensive')}><span className="document-choice__radio" /><span><strong>종합심사</strong><small>종합심사 제출서류</small></span><span className="document-choice__badge document-choice__badge--muted">준비 중</span></button>
              </div>
            </section>

            {!qualification && <div className="document-notice" role="status">종합심사의 추가 입력항목과 양식은 준비 중입니다. 현재는 공통 기본정보를 입력할 수 있습니다.</div>}

            <div className="document-workspace">
              <div className="document-content">
                <section className="document-panel" aria-labelledby="document-notice-title">
                  <header className="document-section-heading"><div><h2 id="document-notice-title">공고 기본정보</h2><p>제출서류에 공통으로 사용할 공고 정보를 입력하세요.</p></div><span className="document-section-tag">공통 정보</span></header>
                  <div className="document-fields">
                    <DocumentField label="발주처"><select value={form.ownerId} onChange={(event) => update('ownerId', event.target.value)}><option value="">발주처 선택</option>{AGREEMENT_GROUPS.map((group) => <option key={group.ownerId} value={group.ownerId}>{group.label}</option>)}</select></DocumentField>
                    <DocumentField label="금액대"><select value={form.rangeId} disabled={!form.ownerId} onChange={(event) => update('rangeId', event.target.value)}><option value="">{form.ownerId ? '금액대 선택' : '발주처를 먼저 선택하세요'}</option>{rangeOptions.map((range) => <option key={range.key} value={range.key}>{range.label}</option>)}</select></DocumentField>
                    <DocumentField label="공종"><select className="document-industry-select" data-industry={form.industry} value={form.industry} onChange={(event) => state.changeIndustry(event.target.value)}>{INDUSTRIES.map((industry) => <option key={industry.value} value={industry.value}>{industry.label}</option>)}</select></DocumentField>
                    <DocumentField label="공고번호">{input('noticeNo', '공고번호 입력')}</DocumentField>
                    <DocumentField label="공고명" wide>{input('noticeTitle', '공고명을 입력해 주세요')}</DocumentField>
                    <DocumentField label="추정가격" suffix="원"><AmountInput value={form.estimatedPrice} onChange={(value) => update('estimatedPrice', value)} placeholder="금액 입력" /></DocumentField>
                    <DocumentField label="기초금액" suffix="원"><AmountInput value={form.baseAmount} onChange={(value) => update('baseAmount', value)} placeholder="금액 입력" /></DocumentField>
                    <div className="document-bid-inputs" role="group" aria-labelledby="document-bid-inputs-title">
                      <div className="document-bid-inputs__heading"><h3 id="document-bid-inputs-title">입찰가격 평가정보</h3><p>입찰가격 점수 산출에 사용할 실제 금액을 입력하세요.</p></div>
                      <div className="document-bid-inputs__fields">
                        <DocumentField label="입찰가격" suffix="원" hint="실제 투찰금액"><AmountInput value={form.bidAmount} onChange={(value) => update('bidAmount', value)} placeholder="입찰가격 입력" /></DocumentField>
                        <DocumentField label="예정가격" suffix="원" hint="확정된 예정가격"><AmountInput value={form.expectedPrice} onChange={(value) => update('expectedPrice', value)} placeholder="예정가격 입력" /></DocumentField>
                        <DocumentField label="A값" suffix="원" hint="국민연금·건강보험 등 합산액"><AmountInput value={form.aValue} onChange={(value) => update('aValue', value)} placeholder="A값 입력" /></DocumentField>
                      </div>
                    </div>
                    <DocumentField label="공고일">{input('noticeDate', '', 'date')}</DocumentField>
                    <DocumentField label="작성날짜">{input('writtenDate', '', 'date')}</DocumentField>
                    <DocumentField label="입찰마감일시" wide>{input('bidDeadline', '', 'datetime-local')}</DocumentField>
                  </div>
                </section>

                <section className="document-panel document-participants" aria-labelledby="document-participants-title">
                  <DocumentExperienceStatus experience={experience} />
                  <header className="document-section-heading"><div><h2 id="document-participants-title">참여업체 정보</h2><p>대표사와 구성사를 선택하고, 서류에 필요한 상세정보를 입력하세요.</p></div></header>
                  <div className="document-company-count"><span>협정 업체 수 <small>대표사 포함</small></span><div role="group" aria-label="협정 업체 수">{[2, 3, 4, 5].map((count) => <button key={count} type="button" aria-pressed={form.companyCount === count} onClick={() => update('companyCount', count)}>{count}개사</button>)}</div></div>
                  <p className="document-participant-hint">업체 수를 줄여도 입력 내용은 이 탭에 유지됩니다. 현재 선택한 업체 수만 작성 현황에 반영됩니다.</p>
                  <div className="document-company-list">{companies.map((company, index) => <CompanyDocumentCard key={index} company={company} index={index} onChange={(key, value) => state.updateCompany(index, key, value)} onSearch={() => state.setPickerIndex(index)} showLhExperience={Boolean(experience.snapshot)} qualityDefault={experience.snapshot?.criteria.qualityDefault} onRefreshManagement={() => state.refreshManagement(index)} managementLoading={state.managementLoadingIndex === index} managementEvaluation={application?.model.methods[index]} />)}</div>
                </section>
              </div>

              <aside className="document-summary" aria-label="작성 현황">
                <div className="document-summary__header"><span className="document-eyebrow">현재 작성 중</span><h2>{qualification ? '적격심사' : '종합심사'} 서류</h2><p>{form.noticeTitle || '공고명을 입력해 주세요'}</p><p>금액대: {selectedRange?.label || '미선택'}</p></div>
                <dl className="document-summary__details"><div><dt>발주처</dt><dd>{owner?.label || '미선택'}</dd></div><div><dt>공종</dt><dd>{INDUSTRIES.find((industry) => industry.value === form.industry)?.label}</dd></div><div><dt>참여업체</dt><dd>{form.companyCount}개사</dd></div><div><dt>작성날짜</dt><dd>{form.writtenDate || '미입력'}</dd></div></dl>
                <div className="document-summary__companies"><div className="document-summary__label"><strong>업체 선택</strong><span>{selectedCount} / {form.companyCount}</span></div><progress value={selectedCount} max={form.companyCount} aria-label="업체 선택 현황" />{companies.map((company, index) => <div className="document-summary__company" key={index}><span>{index === 0 ? '대표사' : `구성사 ${index}`}</span><strong>{company.name || '미선택'}</strong><span>{company.share !== '' ? `${company.share}%` : '—'}</span></div>)}</div>
                <div className={`document-share-summary${shares.complete ? ' is-complete' : ''}`}><div><strong>참여비율 합계</strong><span>{shares.total}<small>%</small></span></div><p>{shares.complete ? '참여비율 합계가 100%입니다.' : '각 업체의 참여비율을 입력해 합계를 확인하세요.'}</p></div>
                <div className="document-summary__footer"><p role="status">{state.draftSaved ? '입력 내용은 현재 브라우저 탭에 임시 보관됩니다.' : '임시 보관을 사용할 수 없습니다. 페이지를 나가면 입력 내용이 사라질 수 있습니다.'}</p><button type="button" className="document-button document-button--primary" disabled={!application} onClick={() => { setPreviewPage(1); setApplicationOpen(true); }}>신청서 미리보기</button>{overview && <button type="button" className="document-button document-button--secondary" onClick={() => { setPreviewPage(2); setApplicationOpen(true); }}>1. 총괄 미리보기</button>}{overview && <button type="button" className="document-button document-button--secondary" onClick={() => { setPreviewPage(4); setApplicationOpen(true); }}>2. 시공경험 미리보기</button>}{overview && <button type="button" className="document-button document-button--secondary" onClick={() => { setPreviewPage(5); setApplicationOpen(true); }}>3. 경영상태 미리보기</button>}{overview && <button type="button" className="document-button document-button--secondary" onClick={() => { setPreviewPage(7); setApplicationOpen(true); }}>4. 신인도 미리보기</button>}{overview && <button type="button" className="document-button document-button--secondary" onClick={() => { setPreviewPage(9); setApplicationOpen(true); }}>5·6. 하도급·자재 미리보기</button>}{overview && <button type="button" className="document-button document-button--secondary" onClick={() => { setPreviewPage(10); setApplicationOpen(true); }}>7. 입찰가격 미리보기</button>}<p>{application ? '신청서와 구현된 자기평가표를 확인하고 PDF로 내려받으세요.' : 'LH 적격심사의 발주처와 금액대를 선택하면 신청서를 만들 수 있습니다.'}</p></div>
              </aside>
            </div>
            </fieldset>
          </div>
        </main>
      </div>
      <CompanySearchModal open={state.pickerIndex !== null} fileType={form.industry} allowAll={false} forceWebSearch dedupeResults onClose={() => state.setPickerIndex(null)} onPick={state.pickCompany} />
      {library.saveOpen && <DocumentSaveDialog record={state.record} form={form} saving={library.saving} error={library.saveError} onSave={library.save} onClose={library.closeSave} />}
      {library.loadOpen && <DocumentLoadDialog library={library} currentId={state.record?.id} />}
      {materialsOpen && <MajorMaterialsDialog onClose={() => setMaterialsOpen(false)} />}
      {applicationOpen && application && <LhApplicationPreview application={application} overview={overview} initialPage={previewPage} onClose={() => setApplicationOpen(false)} />}
    </div>
  );
}
