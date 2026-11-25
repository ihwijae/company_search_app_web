const BIZ_YEARS_DATE_PATTERN = /(\d{2,4})[^0-9]{0,3}(\d{1,2})[^0-9]{0,3}(\d{1,2})/;
const BIZ_YEARS_MS_PER_DAY = 24 * 60 * 60 * 1000;
const BIZ_YEARS_MS_PER_YEAR = 365.2425 * BIZ_YEARS_MS_PER_DAY;
const BIZ_YEARS_EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30));

const isValidDateValue = (value) => value instanceof Date && !Number.isNaN(value.getTime());

const parseDateLikeForBizYears = (raw) => {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) return isValidDateValue(raw) ? raw : null;

  if (typeof raw === 'number') {
    if (raw > 1000) {
      const milliseconds = Math.round(raw * BIZ_YEARS_MS_PER_DAY);
      const date = new Date(BIZ_YEARS_EXCEL_EPOCH.getTime() + milliseconds);
      if (isValidDateValue(date)) return date;
    }
    return null;
  }

  const text = String(raw || '').trim();
  if (!text) return null;

  const match = text.match(BIZ_YEARS_DATE_PATTERN);
  if (match) {
    let year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      if (year < 100) year += year >= 70 ? 1900 : 2000;
      const date = new Date(year, month - 1, day);
      if (isValidDateValue(date)) return date;
    }
  }

  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (digitsOnly.length === 8) {
    const year = Number(digitsOnly.slice(0, 4));
    const month = Number(digitsOnly.slice(4, 6));
    const day = Number(digitsOnly.slice(6, 8));
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const date = new Date(year, month - 1, day);
      if (isValidDateValue(date)) return date;
    }
  }
  return null;
};

const parseBizYearsFromText = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const yearMonthMatch = text.match(/(\d+(?:\.\d+)?)\s*년\s*(\d+(?:\.\d+)?)?\s*개월?/);
  if (yearMonthMatch) {
    const yearsPart = Number(yearMonthMatch[1]);
    const monthsPart = yearMonthMatch[2] != null ? Number(yearMonthMatch[2]) : 0;
    const total = (Number.isFinite(yearsPart) ? yearsPart : 0) + (Number.isFinite(monthsPart) ? monthsPart / 12 : 0);
    if (Number.isFinite(total) && total > 0) return Number(total.toFixed(4));
  }
  const monthsOnlyMatch = text.match(/(\d+(?:\.\d+)?)\s*개월/);
  if (monthsOnlyMatch) {
    const months = Number(monthsOnlyMatch[1]);
    if (Number.isFinite(months) && months > 0) return Number((months / 12).toFixed(4));
  }
  return null;
};

// Preserve Excel dates before the document form serializes all inputs as text.
export function formatBusinessPeriodForDocument(value) {
  const english = typeof value === 'string' ? value.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/) : null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = english && months.includes(english[1])
    ? new Date(Number(english[3]), months.indexOf(english[1]), Number(english[2]))
    : parseDateLikeForBizYears(value);
  if (date) return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return value == null ? '' : String(value).trim();
}

export const resolveCandidateBusinessYears = (candidate, evaluationDateRaw, { extractAmountValue, toNumber } = {}) => {
  const rawValue = extractAmountValue(
    candidate,
    ['bizYears', '영업기간', '설립연수', '업력'],
    [['영업기간', '업력', 'bizyears']],
  );
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  const evaluationDate = parseDateLikeForBizYears(evaluationDateRaw) || new Date();
  evaluationDate.setHours(0, 0, 0, 0);

  const startDate = parseDateLikeForBizYears(rawValue);
  if (startDate) {
    const base = evaluationDate.getTime();
    const diff = base - startDate.getTime();
    const years = diff > 0 ? (diff / BIZ_YEARS_MS_PER_YEAR) : 0;
    return Number.isFinite(years) ? Number(years.toFixed(4)) : 0;
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue > 0 && rawValue <= 200) {
    return Number(rawValue.toFixed(4));
  }

  const fromText = parseBizYearsFromText(rawValue);
  if (fromText != null) return fromText;

  const numeric = toNumber(rawValue);
  if (Number.isFinite(numeric) && numeric > 0 && numeric <= 200) {
    return Number(numeric.toFixed(4));
  }
  return null;
};

