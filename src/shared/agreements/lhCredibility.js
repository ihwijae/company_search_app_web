// Form wording from the supplied LH self-evaluation PDF. All applicant scores
// are fixed at zero for now; no agreement-board credibility rules are changed.
import { getLhDocumentConfig } from './lhDocumentConfig.js';
import { LH_UNDER50_CREDIBILITY_TEMPLATE } from './lhUnder50Credibility.js';
const ITEMS = [
  {
    id: 'integrity', category: '시공업체로서의 성실성', allocation: '-2',
    factor: '최근 1년간 「건설산업기본법」에서 정한 벌금 이상의 행정형벌, 영업정지, 영업·면허·등록취소 처분 또는 과징금 부과처분을 받은 자',
    grades: 'A: 「건설산업기본법 시행령」 제80조 및 별표 6에 의거 영업정지 또는 과징금을 선택할 수 있는 규정에 따라 영업정지 또는 과징금부과 처분을 받은 사실이 있는 자\n\nB: 벌금이상의 행정형벌(집행유예 포함), 영업정지(「건설산업기본법 시행령」 제80조 및 별표 6에 의거 영업정지 또는 과징금을 선택할 수 없는 영업정지만 해당. 처분기간 만료후 1년간 적용), 영업·면허·등록취소(말소)처분을 받은 사실이 있는 자',
    points: '-1.0\n\n-2.0',
  },
  {
    id: 'subcontract-orders', category: '하도급 관련사항', allocation: '-7',
    factor: '최근 2년간 공정거래위원장으로부터 불공정하도급거래행위로 과징금부과 및 시정명령 처분을 받은 사실이 있는 자',
    grades: 'A: 처분을 1회 받은 자\nB: 처분을 2회 받은 자\nC: 처분을 3회 이상 받은 자', points: '-3.0\n-5.0\n-7.0',
  },
  {
    id: 'habitual-subcontract', category: '하도급 관련사항', allocation: '-7',
    factor: '최근 2년 이내에 공정거래위원장으로부터 하도급 상습위반자로 통보받은 자',
    grades: '최근 2년 이내에 공정거래위원장으로부터 하도급 상습위반자로 통보받은 자', points: '-7',
  },
  {
    id: 'safety-expenses', category: '건설재해 및 제재처분', allocation: '-1',
    factor: '최근 1년동안 「산업안전보건법」 제30조제3항에 따른 산업안전보건관리비 사용의무를 위반하여 목적외 사용금액이 1,000만원을 초과하거나 사용내역서를 작성·보존하지 아니한 자',
    grades: 'A: 과태료처분을 받은 사실이 있는 자\nB: 과태료 처분을 2회 이상 받은 사실이 있는 자', points: '-0.5\n-1.0',
  },
  {
    id: 'accident-reports', category: '건설재해 및 제재처분', allocation: '-2',
    factor: '최근 1년동안 「산업안전보건법 시행규칙」 별표 1 제1호 및 제6호의 규정에 따른 산업재해발생 보고의무 위반건수가 배분된 자',
    grades: '과태료 처분을 받은 산업재해발생 보고의무 위반 1건당 -0.2점씩 부여하여 최대 -2.0까지 부여', points: '-0.2/건',
  },
  {
    id: 'safety-sanctions', category: '건설재해 및 제재처분', allocation: '-1',
    factor: '최근 1년동안 산업안전보건법령 위반으로 동일현장에서 벌금 이상의 행정형벌을 2회 이상 받은 자',
    grades: 'A: 2회 받은 자\nB: 3회 이상 받은 자', points: '-0.5\n-1.0',
  },
  {
    id: 'environment', category: '건설재해 및 제재처분', allocation: '-1',
    factor: '최근 1년간 환경관련법령에 의한 벌금이상의 행정형벌, 영업정지, 과징금 이상의 처벌을 받은 자',
    grades: 'A: 1회 받은 자\nB: 2회 이상 받은 자', points: '-0.5\n-1.0',
  },
  {
    id: 'penalty-points', category: '합산벌점', allocation: '-5',
    factor: '국토교통부장관이 평가 통보한 벌점(최근 2년간 건설업체별 합산벌점)',
    grades: 'A: 0.5점 미만\nB: 0.5점 이상 1점 미만\nC: 1점 이상 2점 미만\nD: 2점 이상 10점 미만\nE: 10점 이상 15점 미만\nF: 15점 이상 20점 미만\nG: 20점 이상', points: '-0.1\n-0.2\n-0.3\n-1.0\n-2.0\n-3.0\n-5.0',
  },
  {
    id: 'employment', category: '일자리 창출 관련', allocation: '+1.5',
    factor: '일자리 창출실적(고용인력 증가 등)이 확인되는 자',
    grades: 'A. 근로내용 확인 신고서(「고용보험법 시행규칙」 별지 제7호서식)로 신고한 최근 6개월 평균 고용인원과 급여지급액이 그 이전 6개월 평균보다 증가한 경우\n\nB. 국세청 홈텍스 또는 관할세무서에서 발급한 표준손익계산서(「법인세법 시행규칙」 별지 제3호의3서식), 「법인세법」 등에 따라 관할세무서에 신고된 손익계산서(공인회계사 또는 세무사 증명필요, 「법인세법 시행규칙」 별지 제3호의3서식 준용)상 전년도 급여액(퇴직급여액 제외)이 전전년도 급여액(퇴직급여액 제외)보다 증가한 경우',
    points: '+1.0\n\n+0.5',
  },
];

export function buildLhCredibilityPage(members, rangeId = 'lh-50to100') {
  const template = rangeId === 'lh-under50' ? LH_UNDER50_CREDIBILITY_TEMPLATE : null;
  const { items, ...layout } = template || { items: ITEMS };
  return {
    version: 1, mode: 'fixed-zero', score: 0,
    ...layout,
    members: members.map((member) => ({ name: member.name, share: member.share, score: 0 })),
    items: items.map((item) => ({ ...item, scores: members.map(() => item.scoreBlank ? '' : 0) })),
  };
}

export function withFixedLhCredibility(snapshot) {
  if (snapshot.model.credibilityPage?.mode === 'fixed-zero') {
    if (snapshot.scope.rangeId === 'lh-under50' && snapshot.model.credibilityPage.templateId !== LH_UNDER50_CREDIBILITY_TEMPLATE.templateId) {
      return { ...snapshot, model: { ...snapshot.model, credibilityPage: buildLhCredibilityPage(snapshot.model.members, snapshot.scope.rangeId) } };
    }
    return snapshot;
  }
  const { model, criteria } = snapshot;
  const scores = { ...model.scores, credibility: 0 };
  const round = (value) => Math.round(value * 10 ** criteria.scoreDigits) / 10 ** criteria.scoreDigits;
  const shareComplete = Math.abs((model.shareSum || 0) - 100) < .01;
  const subtotalKeys = getLhDocumentConfig(snapshot.scope.rangeId).subtotalKeys;
  scores.subtotal = shareComplete && subtotalKeys.every((key) => Number.isFinite(scores[key]))
    ? round(subtotalKeys.reduce((sum, key) => sum + scores[key], 0)) : null;
  scores.total = scores.subtotal != null && Number.isFinite(scores.bid) ? round(scores.subtotal + scores.bid) : null;
  const pending = model.pending.filter((item) => item !== '신인도');
  return {
    ...snapshot,
    criteria: { ...criteria, credibility: { version: 1, mode: 'fixed-zero', score: 0 } },
    model: {
      ...model, scores, pending, credibilityPage: buildLhCredibilityPage(model.members, snapshot.scope.rangeId),
      complete: model.missing.length === 0 && pending.length === 0 && scores.total != null,
    },
  };
}
