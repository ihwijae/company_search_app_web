import React from 'react';
import { getLhDocumentConfig } from '../../../../shared/agreements/lhDocumentConfig.js';

const value = (score) => score == null ? '미산정' : `${Number(score.toFixed(2))}점`;

export default function LhOverviewStatus({ overview }) {
  const { model } = overview;
  const config = getLhDocumentConfig(overview.scope.rangeId);
  const items = [
    ['시공경험', model.scores.construction], ['경영상태', model.scores.management],
    ...(config.includeFixedSections ? [['하도급 관리계획', model.scores.subcontract], ['자재·인력조달', model.scores.material]] : []),
    ['신인도', model.scores.credibility], ['입찰가격', model.scores.bid],
    ['당해공사 수행능력 소계', model.scores.subtotal], ['종합평점', model.scores.total],
  ];
  const bidResult = model.bidResult;
  return <section className="application-overview-status"><span className="document-library-caption">1. 총괄 · {config.label}</span><h3>자기평가 점수</h3><dl>{items.map(([label, score]) => <div key={label}><dt>{label}</dt><dd>{value(score)}</dd></div>)}</dl>{bidResult?.status === 'complete' && <p>입찰가격 평가비율: {bidResult.ratioRounded.toFixed(overview.criteria.bidPrice.ratioDigits)} · 입찰가격 점수: {value(model.scores.bid)}</p>}<p>신인도는 모든 업체·항목을 0점으로 반영합니다.</p>{model.pending.length > 0 && <p>{model.pending.join('·')} 평가정보를 확인해 주세요.</p>}{model.missing.length > 0 && <ul className="application-preview-missing">{model.missing.map((item) => <li key={item}>{item}</li>)}</ul>}</section>;
}
