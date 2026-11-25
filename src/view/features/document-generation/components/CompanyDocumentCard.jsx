import React from 'react';
import DocumentField from './DocumentField.jsx';
import { CREDIT_AGENCIES } from '../documentForm.js';
import AmountInput from '../../../../components/AmountInput.jsx';

export default function CompanyDocumentCard({ company, index, onChange, onSearch, showLhExperience = false, qualityDefault = 85, onRefreshManagement, managementLoading = false, managementEvaluation }) {
  const label = index === 0 ? '대표사' : `구성사 ${index}`;
  const input = (key, placeholder, props = {}) => (
    <input value={company[key]} placeholder={placeholder} onChange={(event) => onChange(key, event.target.value)} {...props} />
  );

  return (
    <article className={`document-company${index === 0 ? ' document-company--leader' : ''}`}>
      <header className="document-company__header">
        <div className="document-company__identity"><span className="document-role">{label}</span><h3>{company.name || '업체를 선택해 주세요'}</h3><span className="document-company__biz">{company.bizNo ? `사업자번호 ${company.bizNo}` : '선택한 공종의 업체를 조회합니다'}</span></div>
        <button type="button" className="document-button document-button--secondary" aria-label={`${label} ${company.name ? '업체 변경' : '업체 조회'}`} onClick={onSearch}><span aria-hidden="true">⌕</span> {company.name ? '업체 변경' : '업체 조회'}</button>
      </header>
      <div className="document-fields document-fields--company">
        <DocumentField label="대표자">{input('representative', '대표자명')}</DocumentField>
        <DocumentField label="공사참여비율" suffix="%">{input('share', '예: 51', { type: 'number', min: 0, max: 100, step: 'any', inputMode: 'decimal' })}</DocumentField>
        <DocumentField label="도급순위">{input('rank', '예: 2886 위 / 21,276 개')}</DocumentField>
        {showLhExperience && <>
          <DocumentField label="경영상태 평가방법" wide hint={managementEvaluation?.validationMessage || '자동 선택은 높은 점수를 적용합니다. 가목·나목을 직접 지정할 수도 있습니다.'}>
            <select value={company.managementMethod || 'auto'} aria-invalid={Boolean(managementEvaluation?.validationMessage)} onChange={(event) => onChange('managementMethod', event.target.value)}>
              <option value="auto">자동 선택 (높은 점수)</option>
              <option value="composite">재무비율 평가 (가목 · 부채비율·유동비율·영업기간)</option>
              <option value="credit">신용평가 (나목 · 유효한 신용평가등급)</option>
            </select>
          </DocumentField>
          <DocumentField label="시공능력공시액" suffix="원"><AmountInput value={company.sipyungAmount} onChange={(value) => onChange('sipyungAmount', value)} placeholder="조회된 시평액 확인 또는 입력" /></DocumentField>
          <DocumentField label="최근 5년 실적" suffix="원"><AmountInput value={company.performance5y} onChange={(value) => onChange('performance5y', value)} placeholder="조회된 실적 확인 또는 입력" /></DocumentField>
          <DocumentField label="LH 품질평가 점수" hint={`미평가 업체는 기존 규칙에 따라 ${qualityDefault}점 적용`}>{input('qualityScore', `미평가 시 ${qualityDefault}점`, { inputMode: 'decimal' })}</DocumentField>
        </>}
        <DocumentField label="주소" wide>{input('address', '사업장 주소')}</DocumentField>
        <DocumentField label="전화번호">{input('phone', '예: 02-1234-5678', { type: 'tel' })}</DocumentField>
        <DocumentField label="작성자">{input('writer', '서류 작성자명')}</DocumentField>
        <DocumentField label="법인등록번호">{input('corporateNo', '법인등록번호')}</DocumentField>
        <DocumentField label="업체등록번호">{input('registrationNo', '업체등록번호')}</DocumentField>
        <DocumentField label="평가받은 신용정보업체" wide>
          <select value={company.creditAgency} onChange={(event) => onChange('creditAgency', event.target.value)}>
            <option value="">신용정보업체 선택</option>
            {CREDIT_AGENCIES.map((agency) => <option key={agency} value={agency}>{agency}</option>)}
          </select>
        </DocumentField>
        <DocumentField label="안전보건인증서 보유여부">
          <select value={company.safetyCertificate} onChange={(event) => onChange('safetyCertificate', event.target.value)}>
            <option value="">보유여부 선택</option><option value="yes">예</option><option value="no">아니오</option>
          </select>
        </DocumentField>
        <DocumentField label="안전관리감점 사항" wide>
          <textarea rows={2} value={company.safetyDeductions} placeholder="감점 사항을 입력해 주세요. 해당 사항이 없으면 ‘없음’으로 입력하세요." onChange={(event) => onChange('safetyDeductions', event.target.value)} />
        </DocumentField>
      </div>
      {showLhExperience && <details className="document-management-inputs"><summary>신청서 경영상태 평가정보</summary><div className="document-management-actions"><p>업체 선택 시 함께 불러옵니다. 자동 선택에서는 신용평가가 없거나 만료되면 재무비율로 평가하며, 직접 지정한 방식은 필요한 정보를 확인합니다.</p><button type="button" className="document-button document-button--secondary" disabled={!company.name || managementLoading} onClick={onRefreshManagement}>{managementLoading ? '불러오는 중…' : '경영정보 불러오기'}</button></div><div className="document-fields">
        <DocumentField label="신용평가등급·평가기간" wide>{input('creditGradeText', '예: A- (26.03.27~27.03.26)')}</DocumentField>
        <DocumentField label="신용평가 유효기간 / 만료일">{input('creditExpiry', '등급에 기간이 없으면 입력')}</DocumentField>
        <DocumentField label="자료의 만료 표시"><select value={company.creditExpired} onChange={(event) => onChange('creditExpired', event.target.value)}><option value="">유효기간으로 자동 판정</option><option value="true">만료된 자료</option></select></DocumentField>
        <DocumentField label="부채비율" suffix="%">{input('debtRatio', '예: 18.13', { inputMode: 'decimal' })}</DocumentField>
        <DocumentField label="유동비율" suffix="%">{input('currentRatio', '예: 1733.00', { inputMode: 'decimal' })}</DocumentField>
        <DocumentField label="공사업등록일 / 영업기간" wide>{input('bizYears', '예: 2021.02.22 또는 5년 이상')}</DocumentField>
      </div></details>}
    </article>
  );
}
