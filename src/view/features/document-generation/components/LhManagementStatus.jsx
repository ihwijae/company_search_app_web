import React from 'react';

const score = (value) => value == null ? '미산정' : `${Number(value.toFixed(4))}점`;

export default function LhManagementStatus({ model }) {
  return <section className="application-overview-status">
    <span className="document-library-caption">3. 경영상태평가</span><h3>업체별 평가방법</h3>
    <dl>{model.companies.map((company, index) => <div key={index}><dt>{company.name || `업체 ${index + 1}`}<br />{company.method === 'credit' ? '나목 · 신용평가' : company.method === 'composite' ? '가목 · 재무비율' : '평가정보 확인 필요'}</dt><dd>{score(company.contribution)}</dd></div>)}
      <div><dt>경영상태 총합계</dt><dd>{score(model.totalScore)}</dd></div>
    </dl>
    <p>공고일 기준으로 신용평가 유효기간을 확인합니다. 해당 평가방법을 사용하지 않는 업체의 칸은 -로 표시합니다.</p>
    {model.missing.length > 0 && <ul className="application-preview-missing">{model.missing.map((item) => <li key={item}>{item}</li>)}</ul>}
  </section>;
}
