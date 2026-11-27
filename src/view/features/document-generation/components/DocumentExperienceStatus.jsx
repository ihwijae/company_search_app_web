import React from 'react';

export default function DocumentExperienceStatus({ experience }) {
  const { snapshot, hasSavedCriteria } = experience;
  if (!snapshot) return null;
  const { criteria, result } = snapshot;
  return (
    <section className="document-experience-status" aria-label="LH 시공경험평가 기준 연결">
      <div className="document-experience-status__heading"><strong>LH 시공경험평가 연결</strong><span>{hasSavedCriteria ? '저장된 평가 기준' : '현재 공통 기준'}</span></div>
      <p>최근 {criteria.performanceYears}년 실적 · 실적계수 분모: 기초금액 × {criteria.denominatorMultiplier} · 시공경험 상한 {criteria.constructionMax}점</p>
      {result.status === 'complete' ? <p><strong>시공경험 {result.score}점</strong> · 실적 {result.performanceScore}점 + 품질 {result.qualityPoints}점{!result.shareComplete && ' · 참여비율 합계가 100%인지 확인해 주세요.'}</p> : <p>평가 대기: {result.missing.join(', ')} 입력이 필요합니다.</p>}
      <p>품질평가는 업체별 품질점수에 참여비율을 곱해 합산한 뒤, 합산점수에 해당하는 등급·평점을 적용합니다.</p>
    </section>
  );
}
