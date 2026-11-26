import { getLhDocumentConfig } from '../../../../shared/agreements/lhDocumentConfig.js';
import React, { useEffect, useRef, useState } from 'react';
import Modal from '../../../../components/Modal.jsx';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { createApplicationPdfBytes, createSubmissionPdfBytes, downloadApplicationPdf } from '../services/lhApplicationExport.js';
import PdfDocumentPage from './PdfDocumentPage.jsx';
import LhOverviewStatus from './LhOverviewStatus.jsx';
import LhExperienceStatus from './LhExperienceStatus.jsx';
import LhManagementStatus from './LhManagementStatus.jsx';
import './DocumentLoadDialog.css';
import './LhApplicationPreview.css';

const PREVIEW_PAGES = [
  { title: '적격심사 신청서', tab: '신청서', description: '입력정보와 경영상태 평가방법이 반영된 신청서를 확인하세요.' },
  { title: '1. 총괄', tab: '1. 총괄', description: '입력정보와 평가점수를 반영한 총괄표입니다.' },
  { title: '다. 업체현황', tab: '다. 업체현황', description: '대표사와 구성사의 업체정보를 확인하세요.' },
  { title: '2. 시공경험평가', tab: '2. 시공경험', description: '업체별 실적과 참여비율, 실적계수 및 품질평가 결과를 확인하세요.' },
  { title: '3. 경영상태평가 · 가목', tab: '3. 경영상태 · 가', description: '부채비율·유동비율·영업기간으로 평가하는 업체의 계산 결과입니다.' },
  { title: '3. 경영상태평가 · 나목', tab: '3. 경영상태 · 나', description: '신용평가로 평가하는 업체의 등급과 지분 반영 점수입니다.' },
  { title: '4. 신인도 평가', tab: '4. 신인도', description: '신인도 평가항목과 업체별 점수를 확인하세요. 현재 모든 점수는 0점으로 반영합니다.' },
  { title: '4. 신인도 평가', tab: '4. 신인도', description: '신인도 평가의 나머지 항목과 업체별 합계를 확인하세요.' },
  { title: '5. 하도급 · 6. 자재 및 인력조달', tab: '5·6. 하도급·자재', description: '하도급 관리계획의 고정 배점과 자재 및 인력조달 평가 문구를 확인하세요.' },
  { title: '7. 입찰가격점수', tab: '7. 입찰가격', description: '공고정보의 입찰가격·예정가격·A값을 원본 산식에 대입한 결과입니다.' },
];

export default function LhApplicationPreview({ application, overview = null, fontFamily, initialPage = 1, onClose }) {
  const { notify } = useFeedback();
  const closeRef = useRef(null);
  const [bytes, setBytes] = useState(null);
  const [applicationBytes, setApplicationBytes] = useState(null);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const { model } = application;
  const overviewModel = overview?.model || null;
  const config = getLhDocumentConfig(application.scope.rangeId);
  const previewPages = config.includeFixedSections ? PREVIEW_PAGES : [
    ...PREVIEW_PAGES.slice(0, 7),
    { ...PREVIEW_PAGES[9], title: config.bidTitle, tab: '5. 입찰가격' },
  ];
  const selectedPage = previewPages[pageNumber - 1];
  const submissionComplete = model.complete && Boolean(overviewModel?.complete);

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    setError('');
    setBytes(null);
    (async () => {
      try {
        const generated = await createApplicationPdfBytes(model, { allowIncomplete: true, fontFamily });
        const combined = overviewModel ? await createSubmissionPdfBytes(generated, overviewModel, { fontFamily }) : generated;
        if (!canceled) { setApplicationBytes(generated); setBytes(combined); setLoading(false); }
      } catch (failure) {
        if (!canceled) { setError(failure.message || '신청서 미리보기를 만들지 못했습니다.'); setLoading(false); }
      }
    })();
    return () => { canceled = true; };
  }, [model, overviewModel, fontFamily, attempt]);

  const download = () => {
    if (!bytes || !model.complete || loading || error) return;
    try { downloadApplicationPdf(pageNumber >= 2 ? bytes : applicationBytes, model, { includeOverview: pageNumber >= 2, draft: !submissionComplete }); } catch (failure) { notify({ message: failure.message || 'PDF를 내려받지 못했습니다.', type: 'error' }); }
  };
  const header = <header className="document-library-header"><span className="application-preview-page-number">{pageNumber}</span><div><span className="document-library-caption">LH · 적격심사 · {pageNumber === 1 ? '신청서' : '자기평가표'}</span><h2 id="lh-application-preview-title">{selectedPage.title}</h2><p>{selectedPage.description}</p></div><button type="button" className="document-library-close" ref={closeRef} onClick={onClose} aria-label="서류 미리보기 닫기">×</button></header>;
  const footer = <footer className="document-library-footer"><p>{pageNumber === 1 ? '신청서 1페이지 · A4 PDF' : `신청서 + 자기평가표 ${previewPages.length}페이지${submissionComplete ? '' : ' · 작성 중'}`}</p><div className="document-library-footer__actions"><button type="button" className="document-library-button document-library-button--secondary" onClick={onClose}>닫기</button><button type="button" className="document-library-button document-library-button--primary" disabled={loading || !bytes || Boolean(error) || !model.complete} onClick={download}>{pageNumber === 1 ? '신청서 PDF 다운로드' : `신청서·자기평가표 PDF${submissionComplete ? '' : '(작성 중)'}`}</button></div></footer>;
  return (
    <Modal open onClose={onClose} initialFocusRef={closeRef} ariaLabelledby="lh-application-preview-title" disableEscClose={false} maxWidth={1180} overlayClassName="document-library-overlay" boxClassName="document-library-dialog application-preview-dialog" header={header} footer={footer}>
      {overview && <div className="application-preview-tabs" role="group" aria-label="서류 페이지 선택">{previewPages.map((page, index) => <button key={index} type="button" aria-pressed={pageNumber === index + 1} onClick={() => setPageNumber(index + 1)}>{index + 1}페이지 · {page.tab}</button>)}</div>}
      <div className="application-preview-layout">
        <div className="application-preview-paper-area" aria-busy={loading}>
          {loading && <div className="document-library-state" role="status"><span className="document-library-spinner" /><p>서류 미리보기를 준비하고 있습니다.</p></div>}
          {error && <div className="document-library-state" role="alert"><h3>미리보기를 만들지 못했습니다</h3><p>{error}</p><button type="button" className="document-library-button document-library-button--secondary" onClick={() => setAttempt((value) => value + 1)}>다시 시도</button></div>}
          {!loading && !error && bytes && <PdfDocumentPage bytes={bytes} pageNumber={pageNumber} label={selectedPage.title} />}
        </div>
        <aside className="application-preview-info">
          {(pageNumber === 2 || pageNumber >= 7) && overview && <LhOverviewStatus overview={overview} />}
          {pageNumber === 4 && overviewModel?.experiencePage && <LhExperienceStatus model={overviewModel.experiencePage} />}
          {(pageNumber === 5 || pageNumber === 6) && overviewModel?.managementPage && <LhManagementStatus model={overviewModel.managementPage} />}
          <div className="application-preview-status"><span className="document-library-caption">작성 현황</span><h3>{model.complete ? '신청서 작성 완료' : '입력정보를 확인해 주세요'}</h3><p>{model.complete ? '왼쪽 미리보기와 같은 내용으로 PDF를 내려받을 수 있습니다.' : '미입력 항목을 보완하면 PDF를 내려받을 수 있습니다.'}</p></div>
          {!model.complete && <ul className="application-preview-missing">{model.missing.map((item) => <li key={item}>{item}</li>)}</ul>}
          <div className="application-preview-methods"><h3>업체별 경영상태 평가방법</h3><p>공고일 기준 · 업체별 선택 방식 적용</p>{model.methods.map((company, index) => <div key={index}><strong>{company.name || `업체 ${index + 1}`}</strong><span className={company.method ? 'is-complete' : ''}>{company.method === 'credit' ? '신용평가등급' : company.method === 'composite' ? '부채비율 등 재무비율' : '평가정보 확인 필요'}</span>{company.expired && <small>만료된 신용평가는 제외했습니다.</small>}</div>)}</div>
          <p className="application-preview-note">작성한 정보와 평가 결과는 서류생성 화면의 저장 버튼으로 함께 보관할 수 있습니다.</p>
        </aside>
      </div>
    </Modal>
  );
}
