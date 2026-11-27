// Wording and rows from 서류양식/LH_적격심사_50억~100억_신인도.pdf.
const ITEMS = [
  {
    id: 'integrity', category: '시공업체로서의 성실성', allocation: '-2',
    factor: '최근 1년간 「건설산업기본법」에서 정한 벌금 이상의 행정형벌, 영업정지, 영업·면허·등록취소 처분 또는 과징금 부과처분을 받은 자',
    grades: 'A: 「건설산업기본법 시행령」 제80조 및 별표 6에 의거 영업정지 또는 과징금을 선택할 수 있는 규정에 따라 영업정지 또는 과징금부과 처분을 받은 사실이 있는 자\n\nB: 벌금이상의 행정형벌(집행유예 포함), 영업정지(「건설산업기본법 시행령」 제80조 및 별표 6에 의거 영업정지 또는 과징금을 선택할 수 없는 영업정지만 해당. 처분기간 만료후 1년간 적용), 영업·면허·등록취소(말소)처분을 받은 사실이 있는 자',
    points: '-1.0\n\n-2.0', pointsByGrade: ['-1.0', '-2.0'],
  },
  {
    id: 'subcontract-orders', category: '하도급 관련사항', allocation: '-7',
    factor: '최근 2년간 공정거래위원장으로부터 불공정하도급거래행위로 과징금부과 및 시정명령* 처분을 받은 사실이 있는 자\n* <삭제>',
    grades: 'A: 처분을 1회 받은 자\nB: 처분을 2회 받은 자\nC: 처분을 3회 이상 받은 자', points: '-3.0\n-5.0\n-7.0',
  },
  {
    id: 'habitual-subcontract', category: '하도급 관련사항', allocation: '-7',
    factor: '최근 2년 이내에 공정거래위원장으로부터 하도급 상습위반자로 통보받은 자',
    grades: '최근 2년 이내에 공정거래위원장으로부터 하도급 상습위반자로 통보받은 자', points: '-7',
  },
  {
    id: 'accident-mortality', category: '사고사망만인율', allocation: '+3',
    factor: '최근 3년간 고용노동부장관이 산정한 사고사망만인율의 가중평균(평균사고사망만인율의 가중평균 대비)',
    grades: 'A: 평균사고사망만인율 0.20배 이하\nB: 평균사고사망만인율 0.40배 이하\nC: 평균사고사망만인율 0.60배 이하\nD: 평균사고사망만인율 0.80배 이하\nE: 평균사고사망만인율 1.0배 이하\nF: 평균사고사망만인율 1.0배 초과',
    points: '+3.0\n+2.4\n+1.8\n+1.2\n+0.6\n0.0',
  },
  {
    id: 'accident-prevention', category: '산업재해 예방 활동 실적', allocation: '+2',
    factor: '최근 1년간 건설업체의 산업재해예방활동 실적을 고용노동부장관이 평가한 결과 그 실적이 우수한 자',
    grades: 'A: 평점 95점 이상인 자\nB: 평점 90점 이상 95점 미만인 자\nC: 평점 85점 이상 90점 미만인 자\nD: 평점 80점 이상 85점 미만인 자\nE: 평점 75점 이상 80점 미만인 자\nF: 평점 75점 미만인 자',
    points: '+2.0\n+1.6\n+1.2\n+0.8\n+0.4\n0.0',
  },
  {
    id: 'safety-expenses', category: '산업안전보건관리비 사용 관련 위반 건수', allocation: '-1',
    factor: '최근 1년동안 「산업안전보건법」 제30조제3항에 따른 산업안전보건관리비 사용의무를 위반하여 목적외 사용금액이 1,000만원을 초과하거나 사용내역서를 작성·보존하지 아니한 자',
    grades: 'A: 과태료처분을 받은 사실이 있는 자\nB: 과태료 처분을 2회 이상 받은 사실이 있는 자', points: '-0.5\n-1.0',
  },
  {
    id: 'accident-reports', category: '산업재해 발생 보고 위반건수', allocation: '-2',
    factor: '최근 1년동안 「산업안전보건법 시행규칙」 별표 1 제1호 및 제6호의 규정에 따른 산업재해발생 보고의무 위반건수가 배분된 자',
    grades: '과태료 처분을 받은 산업재해발생 보고의무 위반 1건당 -0.2점씩 부여하여 최대 -2.0까지 부여', points: '-0.2/건',
  },
  {
    id: 'safety-sanctions', category: '산업안전보건법령 위반에 따른 행정형벌 부과 건수', allocation: '-1',
    factor: '최근 1년동안 산업안전보건법령 위반으로 동일현장에서 벌금 이상의 행정형벌을 2회 이상 받은 자',
    grades: 'A: 2회 받은 자\nB: 3회 이상 받은 자', points: '-0.5\n-1.0',
  },
  {
    id: 'environment', category: '환경 및 녹색기술 관련 사항', allocation: '-1',
    factor: '최근 1년간 환경관련법령에 의한 벌금이상의 행정형벌, 영업정지, 과징금 이상의 처벌을 받은 자',
    grades: 'A: 1회 받은 자\nB: 2회 이상 받은 자', points: '-0.5\n-1.0',
  },
  {
    id: 'penalty-points', category: '벌점', allocation: '-5',
    factor: '국토교통부장관이 평가 통보한 벌점(최근 2년간 건설업체별 합산벌점)',
    grades: 'A: 0.5점 미만\nB: 0.5점 이상 1점 미만\nC: 1점 이상 2점 미만\nD: 2점 이상 10점 미만\nE: 10점 이상 15점 미만\nF: 15점 이상 20점 미만\nG: 20점 이상', points: '-0.1\n-0.2\n-0.3\n-1.0\n-2.0\n-3.0\n-5.0',
  },
  {
    id: 'employment', category: '일자리 창출 관련', allocation: '+1.5',
    factor: '일자리 창출실적(고용인력 증가 등)이 확인되는 자',
    grades: 'A. 근로내용 확인 신고서(「고용보험법 시행규칙」 별지 제7호서식)로 신고한 최근 6개월 평균 고용인원과 급여지급액이 그 이전 6개월 평균보다 증가한 경우\n\nB. 국세청 홈텍스 또는 관할세무서에서 발급한 표준손익계산서(「법인세법 시행규칙」 별지 제3호의3서식), 「법인세법」 등에 따라 관할세무서에 신고된 손익계산서(공인회계사 또는 세무사 증명필요, 「법인세법 시행규칙」 별지 제3호의3서식 준용)상 전년도 급여액(퇴직급여액 제외)이 전전년도 급여액(퇴직급여액 제외)보다 증가한 경우',
    points: '+1.0\n\n+0.5', pointsByGrade: ['+1.0', '+0.5'],
  },
  {
    id: 'serious-accidents', category: '중대재해를 발생시킨 자', allocation: '-5',
    factor: '최근 1년동안 산업안전보건법을 위반하여 중대재해를 발생시킨 자로 고용노동부장관이 공표(또는 통보)한 자',
    grades: 'A : 사망자 1명\nB : 사망자 2명\nC : 사망자 3명이상', points: '-2\n-3.5\n-5',
  },
  {
    id: 'safety-certification', category: '안전보건경영시스템 인증', allocation: '+1',
    factor: '안전보건경영시스템(ISO-45001, KOSHA-MS)인증을 받은 자',
    grades: '안전보건경영시스템(ISO-45001, KOSHA-MS)인증을 받은 자', points: '+1',
  },
  { id: 'deleted', category: '<삭제>', factor: '<삭제>', allocation: '', grades: '', points: '', scoreBlank: true },
];

export const LH_50TO100_CREDIBILITY_TEMPLATE = {
  templateId: 'lh-50to100-v2',
  itemsPerPage: [7, 7],
  mergeCategories: true,
  summaryLabel: '합 계 [최종평점 : 신인도 평점 합계]\n배점 범위: +1.5 ~ -3',
  items: ITEMS.map((item) => {
    const points = item.points.split('\n');
    return !item.pointsByGrade && points.length > 1 && points.length === item.grades.split('\n').length
      ? { ...item, pointsByGrade: points, gradeSeparator: '\n' } : item;
  }),
};
