const CREDIT_DATE_PATTERN = /(\d{2,4})[^0-9]{0,3}(\d{1,2})[^0-9]{0,3}(\d{1,2})/;
const CREDIT_DATE_PATTERN_GLOBAL = new RegExp(CREDIT_DATE_PATTERN.source, 'g');
const CREDIT_EXPIRED_REGEX = /(expired|만료|기한\s*경과|유효\s*기간\s*만료|기간\s*만료|만기)/i;
const CREDIT_OVERAGE_REGEX = /(over[-\s]?age|기간\s*초과|인정\s*기간\s*초과)/i;
const CREDIT_STATUS_STALE_REGEX = /(경과)/i;
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

export function parseEvaluationDate(value) {
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

export function resolveCreditValidity(candidate) {
  if (!candidate || typeof candidate !== 'object') return { expiry: null, explicitlyExpired: false };
  const flagFields = [
    candidate.creditExpired,
    candidate.snapshot?.creditExpired,
  ];
  for (const flag of flagFields) {
    if (flag === true) return { expiry: null, explicitlyExpired: true };
    if (typeof flag === 'string') {
      const upper = flag.trim().toUpperCase();
      if (upper === 'Y' || upper === 'TRUE' || upper === 'EXPIRED') return { expiry: null, explicitlyExpired: true };
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
  if (textSources.some((text) => CREDIT_EXPIRED_REGEX.test(text) || CREDIT_OVERAGE_REGEX.test(text))) {
    return { expiry: finalExpiry, explicitlyExpired: true };
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
      return { expiry: finalExpiry, explicitlyExpired: true };
    }
  }

  return { expiry: finalExpiry, explicitlyExpired: false };
}

export function isCreditScoreExpired(candidate, { evaluationDate } = {}) {
  const { expiry, explicitlyExpired } = resolveCreditValidity(candidate);
  if (explicitlyExpired) return true;
  if (!expiry) return false;
  const baseDate = parseEvaluationDate(evaluationDate) || new Date();
  baseDate.setHours(0, 0, 0, 0);
  const expiryDate = new Date(expiry.getTime());
  expiryDate.setHours(0, 0, 0, 0);
  return expiryDate < baseDate;
}

