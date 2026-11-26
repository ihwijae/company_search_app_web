// Wording and rows from 서류양식/LH_50억미만_신인도.png.
export const LH_UNDER50_CREDIBILITY_TEMPLATE = {
  templateId: 'lh-under50-v1',
  itemsPerPage: [2],
  summaryLabel: '합 계',
  summaryAllocation: '+1.5',
  items: [
    {
      id: 'employment', category: '일자리 창출 관련', allocation: '+1.5',
      factor: '일자리 창출실적(고용인력 증가 등)이 확인되는 자',
      grades: 'A. 근로내용 확인 신고서(「고용보험법 시행규칙」 별지 제7호서식)로 신고한 최근 6개월 평균 고용인원과 급여지급액이 그 이전 6개월 평균보다 증가한 경우\n\nB. 국세청 홈텍스 또는 관할세무서에서 발급한 표준손익계산서(「법인세법 시행규칙」 별지 제3호의3서식), 「법인세법」 등에 따라 관할세무서에 신고된 손익계산서(공인회계사 또는 세무사 증명필요, 「법인세법 시행규칙」 별지 제3호의3서식 준용)상 전년도 급여액(퇴직급여액 제외)이 전전년도 급여액(퇴직급여액 제외) 보다 증가한 경우',
      points: '+1.0\n\n+0.5',
      pointsByGrade: ['+1.0', '+0.5'],
    },
    {
      id: 'deleted', category: '<삭제>', factor: '<삭제>', allocation: '<삭제>',
      grades: '', points: '', scoreBlank: true,
    },
  ],
};
