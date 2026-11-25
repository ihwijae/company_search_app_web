import React from 'react';

const score = (value) => value == null ? '미산정' : `${value}점`;

export default function LhExperienceStatus({ model }) {
  const { criteria, result } = model;
  const ready = result.status === 'complete';
  return <section className="application-overview-status">
    <span className="document-library-caption">2. 시공경험평가</span><h3>실적·품질평가 결과</h3>
    <dl>
      <div><dt>실적점수</dt><dd>{score(ready ? result.performanceScore : null)}</dd></div>
      <div><dt>품질평가점수</dt><dd>{score(ready ? result.qualityPoints : null)}</dd></div>
      <div><dt>시공경험 합계</dt><dd>{score(result.score)}</dd></div>
    </dl>
    <p>실적계수 분모는 기초금액 × {criteria.denominatorMultiplier}입니다. 양식에는 ‘공사예정금액 × {criteria.denominatorMultiplier}’로 표시합니다.</p>
    <p>실적계수는 소수 {criteria.ratioDigits}자리 반올림을 적용하며, 시공경험 합계는 {criteria.constructionMax}점까지 반영합니다.</p>
    {!ready && <ul className="application-preview-missing">{result.missing.map((item) => <li key={item}>{item} 입력이 필요합니다.</li>)}</ul>}
    {ready && !result.shareComplete && <p>참여비율 합계가 100%인지 확인해 주세요.</p>}
  </section>;
}
