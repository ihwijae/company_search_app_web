import { getCandidateTextField, getQualityBadgeText, normalizeCellText } from '../../../utils/companyIndicators.js';
import { getDocumentRangeOptions } from '../../../shared/navigation.js';
import { resolveCreditValidity, extractCreditGrade } from '../../../shared/agreements/calculations/creditEvaluation.js';
import { formatBusinessPeriodForDocument } from '../../../shared/agreements/calculations/businessYears.js';

export const CREDIT_AGENCIES = [
  '㈜나이스디앤비', '나이스평가정보㈜', '서울평가정보㈜', '한국평가데이터㈜',
  '한국기업평가㈜', '한국신용평가㈜', '나이스신용평가㈜', '㈜이크레더블',
  '서울신용평가㈜', '코리아크레딧뷰로㈜', '한국평가정보㈜', '㈜테크핀레이팅스',
];

export const INDUSTRIES = [
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];

export const createCompany = () => ({
  name: '', bizNo: '', representative: '', share: '', rank: '', address: '',
  phone: '', writer: '', corporateNo: '', creditAgency: '', registrationNo: '',
  safetyDeductions: '', safetyCertificate: '',
  performance5y: '', qualityScore: '', sipyungAmount: '',
  creditGradeText: '', creditExpiry: '', creditExpired: '', creditStatus: '',
  debtRatio: '', currentRatio: '', bizYears: '', managementMethod: 'auto',
});

export const documentSnapshot = (form) => JSON.stringify(form, (key, value) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
    : value
));

export function createDocumentForm() {
  const today = new Date();
  return {
    reviewType: 'qualification', ownerId: '', rangeId: '', industry: 'eung', companyCount: 2,
    estimatedPrice: '', baseAmount: '', bidAmount: '', expectedPrice: '', aValue: '', noticeNo: '', noticeTitle: '', noticeDate: '',
    writtenDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    bidDeadline: '', companies: Array.from({ length: 5 }, createCompany),
  };
}

export function managementFieldsFromSearch(candidate) {
  const field = (...keys) => getCandidateTextField(candidate, keys);
  const creditValidity = resolveCreditValidity(candidate);
  const expiry = creditValidity.expiry;
  const creditExpiry = expiry ? `${expiry.getFullYear()}-${String(expiry.getMonth() + 1).padStart(2, '0')}-${String(expiry.getDate()).padStart(2, '0')}` : '';
  let businessPeriod = '';
  const periodKeys = ['bizYears', '영업기간', '설립연수', '업력', 'biz_years', 'bizYearsStartDate', '영업기간공사업등록일'];
  for (const source of [candidate, candidate?.snapshot]) {
    if (!source || typeof source !== 'object') continue;
    const key = periodKeys.find((name) => source[name] !== undefined && source[name] !== null && source[name] !== '');
    if (key) {
      const raw = source[key];
      businessPeriod = formatBusinessPeriodForDocument(raw instanceof Date || typeof raw === 'number' ? raw : normalizeCellText(raw));
      break;
    }
  }
  return {
    creditGradeText: field('creditGradeText', 'creditGrade', '신용평가', '신용등급', '신용평가등급') || extractCreditGrade(candidate),
    creditExpiry,
    creditExpired: creditValidity.explicitlyExpired ? 'true' : '',
    creditStatus: field('creditStatus', '신용평가상태') || String(candidate?.dataStatus?.credit || candidate?.snapshot?.dataStatus?.credit || ''),
    debtRatio: field('debtRatio', '부채비율', '부채율', '부채비율(%)', 'debt_ratio'),
    currentRatio: field('currentRatio', '유동비율', '유동자산비율', '유동비율(%)', 'current_ratio'),
    bizYears: businessPeriod,
  };
}

export function companyFromSearch(candidate) {
  const field = (...keys) => getCandidateTextField(candidate, keys);
  return {
    ...createCompany(),
    ...managementFieldsFromSearch(candidate),
    name: field('검색된 회사', '업체명', 'name'),
    bizNo: field('사업자번호', '사업자등록번호', 'bizNo'),
    representative: field('대표자', '대표자명', 'representative'),
    address: field('주소', '소재지', '사업장주소', 'address'),
    phone: field('전화번호', '대표전화', '전화', 'phone'),
    corporateNo: field('법인등록번호', 'corporateNo'),
    registrationNo: field('업체등록번호', 'registrationNo'),
    rank: field('도급순위', '시공능력순위'),
    sipyungAmount: field('_sipyung', '시공능력평가액', '시공능력공시액', '시평', '시평액', '시평액(원)', '시평금액', 'sipyungAmount', 'sipyung'),
    performance5y: field('_agreementPerformance5y', '_performance5y', 'performance5y', 'perf5y', '5년 실적', '5년실적', '5년 실적 합계', '최근5년실적', '최근5년실적합계', '5년실적금액', '최근5년시공실적'),
    qualityScore: getQualityBadgeText(candidate) || '',
  };
}

export function normalizeDocumentForm(form) {
  const defaults = createDocumentForm();
  const next = { ...defaults, ...form, companies: defaults.companies.map((company, index) => ({ ...company, ...form.companies[index] })) };
  if (!getDocumentRangeOptions(next.ownerId, next.reviewType).some((range) => range.key === next.rangeId)) next.rangeId = '';
  return next;
}

export function getShareSummary(companies) {
  const entered = companies.filter((company) => company.share !== '');
  const total = Math.round(entered.reduce((sum, company) => sum + Number(company.share || 0), 0) * 10000) / 10000;
  return { total, complete: entered.length === companies.length && total === 100 };
}
