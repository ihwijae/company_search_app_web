const SAFETY_TYPE_PATTERN = /ISO|(?:KOSHA\s*-\s*)?MS/i;
const DATE_TOKEN_PATTERN = /(\d{2,4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})/g;

function parseDateParts(yearText, monthText, dayText) {
  let year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (![year, month, day].every(Number.isFinite)) return null;
  if (year < 100) year += year >= 70 ? 1900 : 2000;

  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function extractConstructionSafetyExpiry(value) {
  const text = String(value ?? '').trim();
  if (!text || !SAFETY_TYPE_PATTERN.test(text)) return null;

  const dates = [];
  DATE_TOKEN_PATTERN.lastIndex = 0;
  let match = DATE_TOKEN_PATTERN.exec(text);
  while (match) {
    const parsed = parseDateParts(match[1], match[2], match[3]);
    if (parsed) dates.push(parsed);
    match = DATE_TOKEN_PATTERN.exec(text);
  }
  return dates.length ? dates[dates.length - 1] : null;
}

export function isConstructionSafetyExpired(value, today = new Date()) {
  const expiry = extractConstructionSafetyExpiry(value);
  if (!expiry) return false;

  const reference = today instanceof Date ? new Date(today) : new Date(today);
  if (Number.isNaN(reference.getTime())) return false;
  reference.setHours(0, 0, 0, 0);
  return expiry.getTime() < reference.getTime();
}
