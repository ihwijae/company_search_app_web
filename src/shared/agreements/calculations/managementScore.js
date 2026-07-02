import { evaluateScores } from '../../evaluator.web.js';

const CREDIT_DATE_PATTERN = /(\d{2,4})[^0-9]{0,3}(\d{1,2})[^0-9]{0,3}(\d{1,2})/;
const CREDIT_DATE_PATTERN_GLOBAL = new RegExp(CREDIT_DATE_PATTERN.source, 'g');
const CREDIT_EXPIRED_REGEX = /(expired|만료|기한\s*경과|유효\s*기간\s*만료|기간\s*만료|만기)/i;
const CREDIT_OVERAGE_REGEX = /(over[-\s]?age|기간\s*초과|인정\s*기간\s*초과)/i;
const CREDIT_STATUS_STALE_REGEX = /(경과)/i;
const PPS_CREDIT_GRADE_SCORES = {
  AAA: 15,
  'AA+': 15,
  AA0: 15,
  'AA-': 15,
  'A+': 15,
  A0: 15,
  'A-': 15,
  'BBB+': 15,
  BBB0: 15,
  'BBB-': 15,
  'BB+': 15,
  BB0: 15,
  'BB-': 14.614,
  'B+': 14.271,
  B0: 14.271,
  'B-': 14.271,
  'CCC+': 12.857,
  CCC0: 12.857,
  'CCC-': 12.857,
  CC: 12.857,
  C: 12.857,
  D: 12.857,
};

function parseExpiryDateToken(token) {
  if (!token) return null;
  const match = String(token).match(CREDIT_DATE_PATTERN);
  if (!match) return null;
  let year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 100) year += year >= 70 ? 1900 : 2000;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractExpiryDateFromText(text) {
  if (!text) return null;
  const source = String(text);
  const explicit = source.match(/(~|부터|:)?\s*([0-9]{2,4}[^0-9]{0,3}[0-9]{1,2}[^0-9]{0,3}[0-9]{1,2})\s*(까지|만료|만기)/);
  if (explicit) {
    const parsed = parseExpiryDateToken(explicit[2]);
    if (parsed) return parsed;
  }
  const tokens = source.match(CREDIT_DATE_PATTERN_GLOBAL);
  if (tokens) {
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
      const parsed = parseExpiryDateToken(tokens[i]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function normalizeAgreementFlag(value) {
  if (value === true) return true;
  if (value === null || value === undefined) return false;
  const str = String(value).trim().toUpperCase();
  if (!str) return false;
  return ['Y', 'YES', 'TRUE', '만점', 'MAX', '완료', 'O', '1'].includes(str);
}

function pickCandidateValue(candidate, ...keys) {
  for (const key of keys) {
    if (!key) continue;
    if (candidate?.[key] != null && candidate[key] !== '') return candidate[key];
    if (candidate?.snapshot?.[key] != null && candidate.snapshot[key] !== '') return candidate.snapshot[key];
  }
  return null;
}

function parseRatioValue(value, toNumber) {
  const parsed = toNumber(value);
  return parsed == null ? null : parsed;
}

function parseBusinessYears(value, toNumber, evaluationDate = null) {
  const direct = toNumber(value);
  if (direct != null && direct >= 0 && direct <= 200) return direct;
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/10년\s*이상|5년\s*이상/u.test(text)) return 5;
  if (/3년\s*이상/u.test(text)) return 3;
  const yearMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*년/u);
  if (yearMatch) {
    const years = Number(yearMatch[1]);
    if (Number.isFinite(years)) return years;
  }
  const dateMatch = text.match(/([0-9]{2,4})[^0-9]{0,3}([0-9]{1,2})[^0-9]{0,3}([0-9]{1,2})/u);
  if (dateMatch) {
    let year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const start = new Date(year, month - 1, day);
    if (!Number.isNaN(start.getTime())) {
      const baseDate = parseEvaluationDate(evaluationDate) || new Date();
      const diffYears = (baseDate.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return diffYears > 0 ? diffYears : 0;
    }
  }
  return null;
}

function calculatePps50To100FinancialScore(candidate, {
  toNumber,
  clampScore,
  evaluationDate = null,
  industryAvg = null,
}) {
  const debtRatio = parseRatioValue(
    pickCandidateValue(candidate, 'debtRatio', 'debt_ratio', '부채비율'),
    toNumber,
  );
  const currentRatio = parseRatioValue(
    pickCandidateValue(candidate, 'currentRatio', 'current_ratio', '유동비율'),
    toNumber,
  );
  const businessYears = parseBusinessYears(
    pickCandidateValue(candidate, 'bizYears', 'biz_years', '영업기간', '업력', '영업기간공사업등록일'),
    toNumber,
    evaluationDate,
  );
  if (debtRatio == null || currentRatio == null || businessYears == null) return null;

  const evaluation = evaluateScores({
    agencyId: 'pps',
    amount: 5000000000,
    industryAvg,
    inputs: {
      debtRatio,
      currentRatio,
      bizYears: businessYears,
      creditGrade: '',
    },
  });
  return clampScore(evaluation?.management?.composite?.score, 15);
}

export function extractCreditGrade(candidate) {
  if (!candidate || typeof candidate !== 'object') return '';
  const sources = [
    candidate.creditGrade,
    candidate.creditGradeText,
    candidate.creditNote,
    candidate['신용평가'],
    candidate['신용등급'],
    candidate['신용평가등급'],
    candidate.snapshot?.['신용평가'],
    candidate.snapshot?.['신용등급'],
  ];
  for (const src of sources) {
    if (!src) continue;
    const str = String(src).trim().toUpperCase();
    if (!str) continue;
    const match = str.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/);
    return match ? match[1] : str.split(/[\s(]/)[0];
  }
  return '';
}

function normalizeCreditGradeToken(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  const match = raw.match(/^([A-Z]{1,3})([0O]|[+-])?/);
  if (!match) return raw.replace(/\s+/g, '');
  const letters = match[1] || '';
  const suffix = match[2] ? match[2].replace('O', '0') : '';
  return `${letters}${suffix}`;
}

function resolvePpsCreditGradeScore(candidate, { clampScore, managementScoreMax }) {
  const grade = normalizeCreditGradeToken(extractCreditGrade(candidate));
  if (!grade) return null;
  const score = PPS_CREDIT_GRADE_SCORES[grade];
  if (!Number.isFinite(score)) return null;
  return clampScore(score, managementScoreMax);
}

function parseEvaluationDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsedToken = parseExpiryDateToken(value);
  if (parsedToken) return parsedToken;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isCreditScoreExpired(candidate, { evaluationDate } = {}) {
  if (!candidate || typeof candidate !== 'object') return false;
  const flagFields = [
    candidate.creditExpired,
    candidate.snapshot?.creditExpired,
  ];
  for (const flag of flagFields) {
    if (flag === true) return true;
    if (typeof flag === 'string') {
      const upper = flag.trim().toUpperCase();
      if (upper === 'Y' || upper === 'TRUE' || upper === 'EXPIRED') return true;
    }
  }

  const explicitExpirySources = [
    candidate.creditExpiry,
    candidate.creditExpiryDate,
    candidate.creditValidUntil,
    candidate.creditExpiryText,
    candidate.creditExpiryLabel,
    candidate['신용평가 유효기간'],
    candidate['신용평가유효기간'],
    candidate['신용평가 기간'],
    candidate['신용평가기간'],
    candidate['신용평가 만료일'],
    candidate['신용만료일'],
    candidate.snapshot?.creditExpiry,
    candidate.snapshot?.creditExpiryDate,
    candidate.snapshot?.creditValidUntil,
    candidate.snapshot?.creditExpiryText,
    candidate.snapshot?.creditExpiryLabel,
    candidate.snapshot?.['신용평가 유효기간'],
    candidate.snapshot?.['신용평가유효기간'],
    candidate.snapshot?.['신용평가 기간'],
    candidate.snapshot?.['신용평가기간'],
    candidate.snapshot?.['신용평가 만료일'],
    candidate.snapshot?.['신용만료일'],
  ].filter(Boolean);
  const parsedExplicit = (() => {
    for (const raw of explicitExpirySources) {
      const parsed = extractExpiryDateFromText(raw);
      if (parsed) return parsed;
    }
    return null;
  })();

  const creditTextKeys = [
    'creditNoteText',
    'creditNote',
    'creditGradeText',
    'creditGrade',
    'creditInfo',
    'creditDetails',
    'creditStatus',
    'creditStatusText',
    'creditValidityText',
    'creditExpiryText',
    '신용평가',
    '신용평가등급',
    '신용등급',
    '신용평가비고',
    '신용평가 비고',
    '신용평가상태',
    '신용상태',
    '신용평가 상태',
  ];

  const collectCreditTexts = (source) => {
    if (!source || typeof source !== 'object') return [];
    return creditTextKeys
      .map((key) => source[key])
      .filter((value) => value !== undefined && value !== null && value !== '')
      .map((value) => String(value));
  };

  const textSources = [
    ...collectCreditTexts(candidate),
    ...collectCreditTexts(candidate.snapshot),
  ];

  const expiryFromText = (() => {
    for (const text of textSources) {
      const parsed = extractExpiryDateFromText(text);
      if (parsed) return parsed;
    }
    return null;
  })();

  const finalExpiry = parsedExplicit || expiryFromText;
  if (finalExpiry) {
    const baseDate = parseEvaluationDate(evaluationDate) || new Date();
    baseDate.setHours(0, 0, 0, 0);
    const expiry = new Date(finalExpiry.getTime());
    expiry.setHours(0, 0, 0, 0);
    if (expiry < baseDate) return true;
  }

  if (textSources.some((text) => CREDIT_EXPIRED_REGEX.test(text) || CREDIT_OVERAGE_REGEX.test(text))) {
    return true;
  }

  const statusSources = [
    candidate.dataStatus,
    candidate['데이터상태'],
    candidate.snapshot?.dataStatus,
    candidate.snapshot?.['데이터상태'],
  ].filter((value) => value && typeof value === 'object');

  for (const status of statusSources) {
    const statusTexts = [
      status.credit,
      status.creditStatus,
      status.creditValidity,
      status['신용평가'],
      status['신용'],
    ].filter((value) => value !== undefined && value !== null && value !== '')
      .map((value) => String(value));
    if (statusTexts.some((text) => CREDIT_EXPIRED_REGEX.test(text)
      || CREDIT_OVERAGE_REGEX.test(text)
      || CREDIT_STATUS_STALE_REGEX.test(text))) {
      return true;
    }
  }

  return false;
}

export function getCandidateManagementScore(candidate, {
  toNumber,
  clampScore,
  managementScoreMax,
  managementScoreVersion,
  preferCurrentEvaluation = false,
  usePps50To100FinancialEvaluation = false,
  evaluationDate = null,
  industryAvg = null,
} = {}) {
  if (!candidate || typeof candidate !== 'object') return null;

  const manualRaw = candidate._agreementManagementManual;
  if (manualRaw !== null && manualRaw !== undefined && manualRaw !== '') {
    const manual = clampScore(toNumber(manualRaw));
    if (manual != null) {
      candidate._agreementManagementScore = manual;
      candidate._agreementManagementScoreVersion = managementScoreVersion;
      return manual;
    }
  }

  if (
    candidate._agreementManagementScore != null
    && candidate._agreementManagementScoreVersion === managementScoreVersion
  ) {
    const cached = clampScore(toNumber(candidate._agreementManagementScore));
    if (cached != null) return cached;
  }

  if (preferCurrentEvaluation) return null;

  if (usePps50To100FinancialEvaluation) {
    const creditExpired = isCreditScoreExpired(candidate, { evaluationDate });
    const financial = calculatePps50To100FinancialScore(candidate, {
      toNumber,
      clampScore,
      evaluationDate,
      industryAvg,
    });
    let credit = clampScore(
      toNumber(pickCandidateValue(candidate, 'creditScore', '_creditScore', '신용점수', '신용평가점수')),
      managementScoreMax,
    );
    if (credit == null) {
      credit = resolvePpsCreditGradeScore(candidate, { clampScore, managementScoreMax });
    }
    if (credit != null && creditExpired) {
      credit = null;
    }
    const candidates = [financial, credit].filter((value) => value != null && Number.isFinite(value));
    if (candidates.length > 0) {
      const best = clampScore(Math.max(...candidates), managementScoreMax);
      candidate._agreementManagementScore = best;
      candidate._agreementManagementScoreVersion = managementScoreVersion;
      return best;
    }
    if (creditExpired) return null;
  }

  const explicitPerfect = [
    candidate.managementIsPerfect,
    candidate.snapshot?.managementIsPerfect,
  ].some(normalizeAgreementFlag);
  if (explicitPerfect) {
    candidate._agreementManagementScore = managementScoreMax;
    candidate._agreementManagementScoreVersion = managementScoreVersion;
    return managementScoreMax;
  }

  const directFields = [
    'managementScore',
    '_managementScore',
    '경영점수',
    '경영평가점수',
    '경영점수합',
  ];
  for (const field of directFields) {
    const raw = pickCandidateValue(candidate, field);
    const parsed = clampScore(toNumber(raw));
    if (parsed != null) {
      candidate._agreementManagementScore = parsed;
      candidate._agreementManagementScoreVersion = managementScoreVersion;
      return parsed;
    }
  }

  const compositeCandidates = [
    pickCandidateValue(candidate, 'managementTotalScore'),
    pickCandidateValue(candidate, 'totalManagementScore'),
    pickCandidateValue(candidate, 'managementScoreTotal'),
    pickCandidateValue(candidate, '경영점수합'),
    pickCandidateValue(candidate, '경영점수총점'),
  ];
  let composite = null;
  for (const value of compositeCandidates) {
    const parsed = clampScore(toNumber(value));
    if (parsed != null) {
      composite = parsed;
      break;
    }
  }

  if (composite == null) {
    const debt = clampScore(
      toNumber(pickCandidateValue(candidate, 'debtScore', 'debtRatioScore', '부채점수', '부채비율점수')),
      managementScoreMax
    );
    const current = clampScore(
      toNumber(pickCandidateValue(candidate, 'currentScore', 'currentRatioScore', '유동점수', '유동비율점수')),
      managementScoreMax
    );
    if (debt != null || current != null) {
      composite = clampScore((debt || 0) + (current || 0));
    }
  }

  let credit = clampScore(
    toNumber(pickCandidateValue(candidate, 'creditScore', '_creditScore', '신용점수', '신용평가점수'))
  );
  if (credit == null && pickCandidateValue(candidate, 'creditGrade') != null && composite != null) {
    credit = null;
  }
  if (credit != null && isCreditScoreExpired(candidate, { evaluationDate })) {
    credit = null;
  }

  const candidates = [composite, credit].filter((value) => value != null && Number.isFinite(value));
  if (candidates.length === 0) return null;
  const best = Math.max(...candidates);
  const clamped = clampScore(best);
  candidate._agreementManagementScore = clamped;
  candidate._agreementManagementScoreVersion = managementScoreVersion;
  return clamped;
}
