import React from 'react';
import '../../../../styles.css';
import '../../../../fonts.css';
import Sidebar from '../../../../components/Sidebar';
import { useFeedback } from '../../../../components/FeedbackProvider.jsx';
import { extractManagerNames } from '../../../../utils/companyIndicators.js';
import { BASE_ROUTES } from '../../../../shared/navigation.js';
import { searchClient } from '../../../../shared/searchClient.js';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

const FILE_TYPE_OPTIONS = [
  { value: 'eung', label: '전기' },
  { value: 'tongsin', label: '통신' },
  { value: 'sobang', label: '소방' },
];
const FILE_TYPE_LABELS = {
  eung: '전기',
  tongsin: '통신',
  sobang: '소방',
};
const OWNER_OPTIONS = [
  { value: 'LH', label: '한국토지주택공사' },
  { value: 'MOIS', label: '행안부' },
  { value: 'PPS', label: '조달청' },
  { value: 'EX', label: '한국도로공사' },
  { value: 'KRAIL', label: '국가철도공단' },
];

const BIZ_FIELDS = ['사업자번호', 'bizNo', '사업자 번호'];
const NAME_FIELDS = ['업체명', '회사명', 'name', '검색된 회사'];
const REPRESENTATIVE_FIELDS = ['대표자', '대표자명'];
const REGION_FIELDS = ['대표지역', '지역'];
const SPECIAL_NAMES = ['조정', '서권형', '구본진'];

const normalizeName = (value) => {
  let name = String(value || '').replace(/\s+/g, '').toLowerCase();
  name = name.replace(/^(주|\(주\)|㈜|주\)|\(합\))/, '');
  name = name.replace(/(주|\(주\)|㈜|주\)|\(합\))$/, '');
  name = name.replace(/이앤/g, '이엔');
  name = name.replace(/앤/g, '엔');
  name = name.replace(/[^a-zA-Z0-9가-힣]/g, '');
  return name;
};

const normalizeBizNumber = (value) => String(value || '').replace(/[^0-9]/g, '');
const normalizeSequence = (value) => {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const pickFirstValue = (obj, fields) => {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of fields) {
    if (obj[key]) return obj[key];
  }
  return '';
};

const buildCompanyOptionKey = (company) => {
  if (!company || typeof company !== 'object') return '';
  const typeToken = String(company?._file_type || '').trim().toLowerCase();
  const biz = normalizeBizNumber(pickFirstValue(company, BIZ_FIELDS));
  if (biz) return typeToken ? `${typeToken}|biz:${biz}` : `biz:${biz}`;
  const name = String(pickFirstValue(company, NAME_FIELDS) || '').trim();
  if (name) return typeToken ? `${typeToken}|name:${name}` : `name:${name}`;
  const fallback = String(company?.id || company?.rowIndex || company?.row || '');
  return fallback ? `${typeToken}|row:${fallback}` : typeToken || Math.random().toString(36).slice(2);
};

const COMMON_SURNAMES = new Set([
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황',
  '안', '송', '류', '유', '홍', '전', '민', '구', '우', '문', '양', '손', '배', '백', '허', '노',
  '심', '하', '곽', '성', '차', '주', '우', '채', '남', '원', '방', '표', '변', '염', '여', '석',
  '설', '선', '현', '나', '진', '지', '위', '도', '연', '길', '엄', '복', '제', '탁', '공', '기',
]);
const COMPANY_SUFFIX_DENY = new Set([
  '건설', '공사', '전기', '전력', '토건', '토목', '산업', '정보', '통신', '소방', '기술', '기계', '기전', '기공',
  '환경', '시스템', '테크', '설비', '전설', '플랜트', '이엔지', '이엔씨', '엔지', '엔씨', '건축',
]);
const CORPORATE_PREFIX_PATTERN = /(주식회사|유한회사|농업회사법인|사단법인|재단법인|합자회사|합명회사|법인)$/;
const TRAILING_HANJA_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]+$/u;
const JOB_TITLE_TOKENS = new Set(['부장', '차장', '과장', '팀장', '대리', '대표', '실장', '소장', '이사', '사장', '전무', '상무', '부사장', '주임', '사원']);

const looksLikePersonName = (token) => {
  if (!token) return false;
  const normalized = token.replace(/[^가-힣]/g, '');
  if (!/^[가-힣]{2,3}$/.test(normalized)) return false;
  if (!COMMON_SURNAMES.has(normalized[0])) return false;
  if (COMPANY_SUFFIX_DENY.has(normalized)) return false;
  for (const suffix of COMPANY_SUFFIX_DENY) {
    if (suffix && suffix !== normalized && normalized.endsWith(suffix)) return false;
  }
  return true;
};

const stripTrailingPersonSuffix = (text) => {
  if (!text) return '';
  const normalized = text.replace(/[^가-힣]/g, '');
  if (normalized.length <= 3) return text;
  for (let len = 3; len >= 2; len -= 1) {
    const suffix = normalized.slice(-len);
    if (!looksLikePersonName(suffix)) continue;
    const prefix = normalized.slice(0, -len);
    if (!prefix || prefix.length < 3) continue;
    if (looksLikePersonName(prefix) && prefix.length <= 3) continue;
    const idx = text.lastIndexOf(suffix);
    if (idx > 0) {
      const candidate = text.slice(0, idx).trim();
      if (candidate) return candidate;
    }
  }
  return text;
};

const cleanCompanyName = (rawName) => {
  if (!rawName) return '';
  const original = String(rawName);
  let primary = original.split('\n')[0];
  primary = primary.replace(/\r/g, '');
  const hasDelimiterHints = /[0-9_%]/.test(primary) || /[_\n\r]/.test(original);
  primary = primary.replace(/\s*[\d.,%][\s\S]*$/, '');
  primary = primary.split('_')[0];
  let trimmed = primary.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  let tokens = trimmed.split(' ').filter(Boolean);
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    const normalized = last.replace(/[^가-힣]/g, '');
    if (!normalized) {
      tokens.pop();
      continue;
    }
    if (JOB_TITLE_TOKENS.has(normalized)) {
      tokens.pop();
      continue;
    }
    const precedingRaw = tokens.slice(0, -1).join(' ').trim();
    if (!precedingRaw) break;
    const precedingNormalized = precedingRaw.replace(/[^가-힣]/g, '');
    if (!looksLikePersonName(normalized)) break;
    if (CORPORATE_PREFIX_PATTERN.test(precedingNormalized)) break;
    tokens.pop();
    break;
  }
  let result = tokens.join(' ').trim();
  if (tokens.length <= 1 && hasDelimiterHints) {
    result = stripTrailingPersonSuffix(result);
  }
  if (hasDelimiterHints) {
    const strippedHanja = result.replace(TRAILING_HANJA_PATTERN, '').trim();
    if (strippedHanja && strippedHanja !== result && /[a-zA-Z0-9가-힣]/.test(strippedHanja)) {
      result = strippedHanja;
    }
  }
  return result;
};

const hasSpecialName = (raw) => {
  const normalized = String(raw || '').replace(/\s+/g, '');
  return SPECIAL_NAMES.some((token) => normalized.includes(token));
};

const summarizeMissingEntries = (entries, candidatesMap) => {
  if (!Array.isArray(entries) || !candidatesMap) return null;
  const seen = new Set();
  const missingNames = [];
  entries.forEach((entry) => {
    const normalized = entry?.normalizedName;
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    const candidates = candidatesMap.get(normalized) || [];
    if (candidates.length > 0) return;
    const displayName = entry.cleanedName || entry.rawName || normalized;
    missingNames.push(displayName);
  });
  if (missingNames.length === 0) return null;
  return {
    totalCount: entries.length,
    missingCount: missingNames.length,
    missingNames,
  };
};

const cloneFont = (font) => {
  if (!font) return font;
  try { return JSON.parse(JSON.stringify(font)); } catch { return font; }
};

const getCellText = (cell) => {
  if (!cell) return '';
  if (cell.text !== undefined && cell.text !== null && String(cell.text).length) {
    return String(cell.text);
  }
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('');
    }
    if (value.formula) {
      return value.result !== undefined && value.result !== null ? String(value.result) : '';
    }
    if (value.text) return String(value.text);
    if (value.hyperlink) return String(value.text || value.hyperlink);
    return '';
  }
  return String(value);
};

const setFontSize = (cell, size) => {
  if (!cell) return;
  const target = cell.isMerged && cell.master ? cell.master : cell;
  if (!target) return;
  const nextFont = { ...(target.font || {}), size };
  target.font = nextFont;
  target.style = { ...(target.style || {}), font: { ...(target.style?.font || {}), size } };
  if (target.value && Array.isArray(target.value.richText)) {
    target.value = {
      ...target.value,
      richText: target.value.richText.map((part) => ({
        ...part,
        font: { ...(part.font || {}), size },
      })),
    };
  }
};

const cloneCellStyle = (cell) => {
  const current = cell?.style;
  if (!current || typeof current !== 'object') return {};
  return { ...current };
};

const applyCellFillStyle = (cell, fill) => {
  if (!cell) return;
  const baseStyle = cloneCellStyle(cell);
  cell.style = {
    ...baseStyle,
    fill: { ...(fill || { type: 'pattern', pattern: 'none' }) },
  };
};

const findLastDataRow = (worksheet) => {
  const maxRow = Math.max(worksheet.rowCount, 14);
  let lastRow = 0;
  for (let row = 14; row <= maxRow; row += 1) {
    const text = getCellText(worksheet.getCell(row, 2)).trim();
    if (text) lastRow = row;
  }
  return lastRow || 13;
};

const autoFitDiffColumn = (worksheet, maxRow, { minWidth = 8, maxWidth = 20 } = {}) => {
  let maxLen = 0;
  for (let row = 15; row <= maxRow; row += 1) {
    const current = worksheet.getCell(row, 5).value;
    const prev = worksheet.getCell(row - 1, 5).value;
    const currentNum = typeof current === 'number' ? current : Number(String(current || '').replace(/[^0-9.-]/g, ''));
    const prevNum = typeof prev === 'number' ? prev : Number(String(prev || '').replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(currentNum) || !Number.isFinite(prevNum)) continue;
    const diff = currentNum - prevNum;
    const text = diff.toLocaleString('en-US');
    if (text.length > maxLen) maxLen = text.length;
  }
  const width = Math.min(maxWidth, Math.max(minWidth, maxLen + 2));
  worksheet.getColumn(16).width = width;
};

const sanitizeDownloadName = (value, fallback = 'output.xlsx') => {
  const cleaned = String(value || '').trim().replace(/[\\/:*?"<>|]/g, '');
  return cleaned || fallback;
};

const columnToNumber = (letters = '') => {
  let num = 0;
  for (let i = 0; i < letters.length; i += 1) {
    const code = letters.toUpperCase().charCodeAt(i) - 64;
    if (code < 1 || code > 26) continue;
    num = num * 26 + code;
  }
  return num;
};

const parseCellRef = (ref = '') => {
  const match = /^([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!match) return null;
  return { col: columnToNumber(match[1]), row: Number(match[2]) };
};

const parseColumnOnly = (ref = '') => {
  const match = /^([A-Z]+)$/i.exec(ref.trim());
  if (!match) return null;
  return { col: columnToNumber(match[1]) };
};

const parseRange = (ref = '') => {
  const cleaned = ref.replace(/\$/g, '').trim();
  if (!cleaned) return null;
  if (!cleaned.includes(':')) {
    const cell = parseCellRef(cleaned);
    if (cell) return { start: cell, end: cell };
    const colOnly = parseColumnOnly(cleaned);
    if (colOnly) return { start: { col: colOnly.col, row: 1 }, end: { col: colOnly.col, row: 1048576 } };
    return null;
  }
  const [startRef, endRef] = cleaned.split(':');
  const startCell = parseCellRef(startRef);
  const endCell = parseCellRef(endRef);
  if (startCell && endCell) {
    return {
      start: { col: Math.min(startCell.col, endCell.col), row: Math.min(startCell.row, endCell.row) },
      end: { col: Math.max(startCell.col, endCell.col), row: Math.max(startCell.row, endCell.row) },
    };
  }
  const startCol = parseColumnOnly(startRef);
  const endCol = parseColumnOnly(endRef);
  if (startCol && endCol) {
    return {
      start: { col: Math.min(startCol.col, endCol.col), row: 1 },
      end: { col: Math.max(startCol.col, endCol.col), row: 1048576 },
    };
  }
  return null;
};

const touchesB14 = (ref = '') => {
  const tokens = ref.split(/\s+/).filter(Boolean);
  const targetCol = 2; // B
  for (const token of tokens) {
    const range = parseRange(token);
    if (!range) continue;
    if (range.end.col < targetCol || range.start.col > targetCol) continue;
    if (range.end.row < 14) continue;
    return true;
  }
  return false;
};

const removeConditionalFormatting = (worksheet) => {
  const list = Array.isArray(worksheet.conditionalFormattings)
    ? worksheet.conditionalFormattings
    : Array.isArray(worksheet.model?.conditionalFormattings)
      ? worksheet.model.conditionalFormattings
      : [];
  const filtered = list.filter((rule) => !touchesB14(rule?.ref || ''));
  worksheet.conditionalFormattings = filtered;
  if (worksheet.model) {
    worksheet.model.conditionalFormattings = filtered;
  }
};

const normalizeRgb = (rgb) => String(rgb || '').replace(/^FF/i, '').toUpperCase();

const isYellowStyleId = (styleId, styleMap) => {
  if (styleId === null || styleId === undefined || !styleMap) return false;
  const xf = styleMap.xfStyles?.[styleId];
  if (!xf) return false;
  const fillRgb = xf.fillId !== null ? styleMap.fillColors?.[xf.fillId] || '' : '';
  return normalizeRgb(fillRgb) === 'FFFF00';
};

const isYellowStyleCell = (cell, styleMap) => {
  if (!cell) return false;
  const style = cell.s;
  let fillRgb = '';
  if (style && typeof style === 'object') {
    fillRgb = style.fill?.fgColor?.rgb || style.fgColor?.rgb || '';
    if (!fillRgb && style.fill?.fgColor?.theme !== undefined) {
      fillRgb = String(style.fill.fgColor.theme || '');
    }
  } else if (typeof style === 'number' && styleMap?.xfStyles?.length) {
    const xf = styleMap.xfStyles[style];
    const fillId = xf?.fillId;
    fillRgb = fillId !== null ? styleMap.fillColors?.[fillId] || '' : '';
  }
  return normalizeRgb(fillRgb) === 'FFFF00';
};


const extractBizNoFromXlsxRow = (sheet, row) => {
  const candidateCols = [2, 3, 4, 1, 5]; // C, D, E, B, F
  for (const col of candidateCols) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: col })];
    const raw = cell ? XLSX.utils.format_cell(cell) : '';
    const bizNo = normalizeBizNumber(raw);
    if (bizNo.length === 10) return bizNo;
  }
  return '';
};

const extractNameFromXlsxRow = (sheet, row) => {
  const candidateCols = [3, 4, 5, 2]; // D, E, F, C
  for (const col of candidateCols) {
    const cell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: col })];
    const raw = cell ? XLSX.utils.format_cell(cell) : '';
    const name = String(raw || '').trim();
    if (name) return name;
  }
  return '';
};

const readOrderingSheetData = (sheet, styleMap, winnerRowsFromXml = []) => {
  const validNumbers = new Set();
  const winnerInfos = [];
  let started = false;
  let emptyStreak = 0;

  const appendWinnerInfo = (row, seq) => {
    const bizNo = extractBizNoFromXlsxRow(sheet, row);
    const companyName = extractNameFromXlsxRow(sheet, row);
    if (!bizNo) return;
    if (winnerInfos.some((info) => info.bizNo === bizNo)) return;
    winnerInfos.push({
      bizNo,
      rank: seq || null,
      companyName,
      sourceRow: row,
    });
  };

  winnerRowsFromXml.forEach((row) => {
    const seqCell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: 0 })];
    const seqRaw = seqCell ? XLSX.utils.format_cell(seqCell) : '';
    const seq = normalizeSequence(seqRaw);
    appendWinnerInfo(row, seq);
  });

  for (let row = 5; row <= 5000; row += 1) {
    const seqCell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: 0 })];
    const seqRaw = seqCell ? XLSX.utils.format_cell(seqCell) : '';
    const seq = normalizeSequence(seqRaw);

    const aCell = sheet[XLSX.utils.encode_cell({ r: row - 1, c: 0 })];
    if (isYellowStyleCell(aCell, styleMap)) {
      appendWinnerInfo(row, seq);
    }

    if (seq) {
      validNumbers.add(seq);
      started = true;
      emptyStreak = 0;
    } else if (started) {
      emptyStreak += 1;
      if (emptyStreak >= 3) break;
    }
  }

  return { validNumbers, winnerInfos, winnerSource: 'yellow-a-col' };
};

const collectOrderingStyleSamples = (sheet, maxRows = 200, maxCols = 12, maxSamples = 30) => {
  const samples = [];
  let yellowLikeCount = 0;
  for (let row = 5; row <= maxRows; row += 1) {
    for (let col = 0; col < maxCols; col += 1) {
      const addr = XLSX.utils.encode_cell({ r: row - 1, c: col });
      const cell = sheet[addr];
      if (!cell) continue;
      if (isYellowStyleCell(cell, null)) {
        yellowLikeCount += 1;
      }
      if (!cell.s) continue;
      if (samples.length >= maxSamples) continue;
      samples.push({
        addr,
        v: cell.v,
        t: cell.t,
        s: cell.s,
      });
    }
  }
  return { samples, yellowLikeCount };
};

const readZipText = async (zip, path) => {
  const file = zip.file(path);
  if (!file) return '';
  return file.async('text');
};

const resolveSheetPathFromXml = (workbookXml, relsXml, sheetName) => {
  if (!workbookXml || !relsXml || !sheetName) return '';
  const escaped = sheetName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const sheetMatch = new RegExp(`<sheet[^>]*name="${escaped}"[^>]*>`, 'i').exec(workbookXml);
  if (!sheetMatch) return '';
  const ridMatch = sheetMatch[0].match(/r:id="([^"]+)"/i);
  if (!ridMatch) return '';
  const rid = ridMatch[1];
  const relMatch = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*>`, 'i').exec(relsXml);
  if (!relMatch) return '';
  const targetMatch = relMatch[0].match(/Target="([^"]+)"/i);
  if (!targetMatch) return '';
  const target = targetMatch[1];
  return target.startsWith('xl/') ? target : `xl/${target}`;
};

const parseStyleMapFromXml = (stylesXml) => {
  if (!stylesXml) return { fillColors: [], xfStyles: [] };
  const fillsBlock = stylesXml.match(/<fills[^>]*>[\s\S]*?<\/fills>/i);
  const xfsBlock = stylesXml.match(/<cellXfs[^>]*>[\s\S]*?<\/cellXfs>/i);
  const fillList = fillsBlock ? (fillsBlock[0].match(/<fill>[\s\S]*?<\/fill>/gi) || []) : [];
  const xfList = xfsBlock ? (xfsBlock[0].match(/<xf[^>]*\/>|<xf[^>]*>[\s\S]*?<\/xf>/gi) || []) : [];

  const fillColors = fillList.map((fill) => {
    const rgbMatch = fill.match(/<fgColor[^>]*rgb="([^"]+)"/i);
    return rgbMatch ? rgbMatch[1] : '';
  });
  const xfStyles = xfList.map((xf) => {
    const fillIdMatch = xf.match(/fillId="(\d+)"/i);
    return {
      fillId: fillIdMatch ? Number(fillIdMatch[1]) : null,
    };
  });

  return { fillColors, xfStyles };
};

const findWinnerRowsBySheetXml = (sheetXml, styleMap) => {
  if (!sheetXml) return [];
  const rows = new Set();
  const cellRegex = /<c[^>]*r=['"]A(\d+)['"][^>]*s=['"](\d+)['"][^>]*>/gi;
  let match = cellRegex.exec(sheetXml);
  while (match) {
    const row = Number(match[1]);
    const styleId = Number(match[2]);
    if (!Number.isNaN(row) && isYellowStyleId(styleId, styleMap)) {
      rows.add(row);
    }
    match = cellRegex.exec(sheetXml);
  }
  const rowRegex = /<row[^>]*r=['"](\d+)['"][^>]*s=['"](\d+)['"][^>]*>/gi;
  match = rowRegex.exec(sheetXml);
  while (match) {
    const row = Number(match[1]);
    const styleId = Number(match[2]);
    if (!Number.isNaN(row) && isYellowStyleId(styleId, styleMap)) {
      rows.add(row);
    }
    match = rowRegex.exec(sheetXml);
  }
  return Array.from(rows.values());
};

const extractOrderingStyleContextFromXml = async (buffer, sheetName) => {
  const zip = await JSZip.loadAsync(buffer);
  const workbookXml = await readZipText(zip, 'xl/workbook.xml');
  const relsXml = await readZipText(zip, 'xl/_rels/workbook.xml.rels');
  const stylesXml = await readZipText(zip, 'xl/styles.xml');
  const sheetPath = resolveSheetPathFromXml(workbookXml, relsXml, sheetName) || 'xl/worksheets/sheet1.xml';
  const sheetXml = await readZipText(zip, sheetPath);
  if (!sheetXml) return { styleMap: null, winnerRows: [] };
  const styleMap = parseStyleMapFromXml(stylesXml);
  const winnerRows = findWinnerRowsBySheetXml(sheetXml, styleMap);
  return { styleMap, winnerRows };
};

const buildActualWinnerLinePrefix = (k3Text = '') => {
  const source = String(k3Text || '').trim();
  if (!source) return '실제낙찰사:';
  const replaced = source
    .replace(/예상\s*낙찰사/gi, '실제낙찰사')
    .replace(/예상낙찰사/gi, '실제낙찰사');
  const colonIdx = replaced.indexOf(':');
  if (colonIdx >= 0) return replaced.slice(0, colonIdx + 1).trim();
  if (replaced.includes('실제낙찰사')) return `${replaced}:`;
  return '실제낙찰사:';
};

const buildActualWinnerSummaryText = (winnerList = []) => {
  const normalized = (Array.isArray(winnerList) ? winnerList : [])
    .filter((info) => info && typeof info === 'object');
  if (!normalized.length) return '';
  const sorted = normalized
    .slice()
    .sort((a, b) => (Number(a?.templateRow) || Number.MAX_SAFE_INTEGER) - (Number(b?.templateRow) || Number.MAX_SAFE_INTEGER));
  const first = sorted[0] || {};
  const rankText = first?.rank ? `${first.rank}순위 ` : '';
  const nameText = String(first?.companyName || first?.bizNo || '').trim();
  if (!nameText) return '';
  const extraCount = sorted.length - 1;
  const tail = extraCount > 0 ? ` 외 ${extraCount}개사` : '';
  return `균형근접 ${rankText}${nameText}${tail}`.replace(/\s+/g, ' ').trim();
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = sanitizeDownloadName(fileName);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const QUALITY_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
};
const AGREEMENT_DEFAULT_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF00B0F0' },
};
const AGREEMENT_SPECIAL_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF00B050' },
};
const ORDERING_INVALID_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFF0000' },
};

export default function BidResultPage() {
  const { notify, confirm } = useFeedback();
  const [ownerId, setOwnerId] = React.useState('');
  const [fileType, setFileType] = React.useState('');
  const [bidAmountOwnerId, setBidAmountOwnerId] = React.useState('');
  const [bidAmountFileType, setBidAmountFileType] = React.useState('');
  const [formatFile, setFormatFile] = React.useState(null);
  const [isFormatting, setIsFormatting] = React.useState(false);
  const [templatePath, setTemplatePath] = React.useState('');
  const [templateFile, setTemplateFile] = React.useState(null);
  const [agreementFile, setAgreementFile] = React.useState(null);
  const [bidAmountAgreementFile, setBidAmountAgreementFile] = React.useState(null);
  const [orderingResultFile, setOrderingResultFile] = React.useState(null);
  const [bidAmountTemplatePath, setBidAmountTemplatePath] = React.useState('');
  const [bidAmountTemplateFile, setBidAmountTemplateFile] = React.useState(null);
  const [isAgreementProcessing, setIsAgreementProcessing] = React.useState(false);
  const [isOrderingProcessing, setIsOrderingProcessing] = React.useState(false);
  const [isBidAmountProcessing, setIsBidAmountProcessing] = React.useState(false);
  const [bidAmountNoticeNo, setBidAmountNoticeNo] = React.useState('');
  const [bidAmountNoticeTitle, setBidAmountNoticeTitle] = React.useState('');
  const [bidAmountDeadlineDate, setBidAmountDeadlineDate] = React.useState('');
  const [bidAmountDeadlinePeriod, setBidAmountDeadlinePeriod] = React.useState('AM');
  const [bidAmountDeadlineTime, setBidAmountDeadlineTime] = React.useState('');
  const [bidAmountBaseAmount, setBidAmountBaseAmount] = React.useState('');
  const [agreementWorkbook, setAgreementWorkbook] = React.useState(null);
  const [bidAmountAgreementWorkbook, setBidAmountAgreementWorkbook] = React.useState(null);
  const [agreementSheetNames, setAgreementSheetNames] = React.useState([]);
  const [bidAmountAgreementSheetNames, setBidAmountAgreementSheetNames] = React.useState([]);
  const [selectedAgreementSheet, setSelectedAgreementSheet] = React.useState('');
  const [bidAmountSelectedAgreementSheet, setBidAmountSelectedAgreementSheet] = React.useState('');
  const [companyConflictSelections, setCompanyConflictSelections] = React.useState({});
  const [companyConflictModal, setCompanyConflictModal] = React.useState({ open: false, entries: [], isResolving: false });
  const [pendingConflictAction, setPendingConflictAction] = React.useState(null);
  const [pendingAgreementEntries, setPendingAgreementEntries] = React.useState(null);
  const [pendingBidAmountEntries, setPendingBidAmountEntries] = React.useState(null);
  const [pendingBidAmountExcluded, setPendingBidAmountExcluded] = React.useState([]);
  const [pendingCandidatesMap, setPendingCandidatesMap] = React.useState(null);

  const formatFileInputRef = React.useRef(null);
  const templateFileInputRef = React.useRef(null);
  const agreementFileInputRef = React.useRef(null);
  const agreementPickerInputRef = React.useRef(null);
  const orderingFileInputRef = React.useRef(null);
  const bidAmountTemplateInputRef = React.useRef(null);
  const templateFileName = templatePath ? templatePath.split(/[\\/]/).pop() : '';
  const bidAmountTemplateName = bidAmountTemplatePath ? bidAmountTemplatePath.split(/[\\/]/).pop() : '';
  const bidAmountOwnerLabel = React.useMemo(() => (
    OWNER_OPTIONS.find((option) => option.value === bidAmountOwnerId)?.label || '한국토지주택공사'
  ), [bidAmountOwnerId]);

  const strongLabelStyle = React.useMemo(() => ({
    display: 'block',
    marginBottom: '6px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#0f172a',
  }), []);
  const sectionCardStyle = React.useMemo(() => ({
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '18px',
    background: '#f8fafc',
    boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)',
  }), []);
  const sectionTitleBadgeStyle = React.useMemo(() => ({
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '999px',
    background: '#0f172a',
    color: '#f8fafc',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.2px',
  }), []);

  const saveProcessedTemplate = React.useCallback((buffer, suffix) => {
    if (!buffer) throw new Error('개찰결과 파일 처리 결과가 비어 있습니다.');
    const baseSource = templateFile?.name || templateFileName || '개찰결과파일.xlsx';
    const baseName = sanitizeDownloadName(baseSource, '개찰결과파일.xlsx').replace(/\.xlsx$/i, '');
    const outputName = `${baseName}_${suffix}.xlsx`;
    const outputBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const nextTemplateFile = new File([outputBlob], outputName, { type: outputBlob.type });
    setTemplateFile(nextTemplateFile);
    setTemplatePath(outputName);
    downloadBlob(outputBlob, outputName);
    return outputName;
  }, [templateFile, templateFileName]);

  const handleSidebarSelect = React.useCallback((key) => {
    if (!key) return;
    if (key === 'search') { window.location.hash = BASE_ROUTES.search; return; }
    if (key === 'agreements') { window.location.hash = BASE_ROUTES.agreementBoard; return; }
    if (key === 'region-search') { window.location.hash = BASE_ROUTES.regionSearch; return; }
    if (key === 'agreements-sms') { window.location.hash = BASE_ROUTES.agreements; return; }
    if (key === 'auto-agreement') { window.location.hash = BASE_ROUTES.autoAgreement; return; }
    if (key === 'records') { window.location.hash = '#/records'; return; }
    if (key === 'mail') { window.location.hash = '#/mail'; return; }
    if (key === 'excel-helper') { window.location.hash = '#/excel-helper'; return; }
    if (key === 'bid-result') { window.location.hash = '#/bid-result'; return; }
    if (key === 'kakao-send') { window.location.hash = '#/kakao-send'; return; }
    if (key === 'company-notes') { window.location.hash = '#/company-notes'; return; }
    if (key === 'settings') { window.location.hash = BASE_ROUTES.settings; return; }
    if (key === 'upload') { window.location.hash = BASE_ROUTES.agreementBoard; }
  }, []);

  const findCompaniesForEntries = React.useCallback(async (entries, targetFileType) => {
    const candidatesMap = new Map();
    for (const entry of entries) {
      if (!entry?.normalizedName) continue;
      if (candidatesMap.has(entry.normalizedName)) continue;
      try {
        const response = await searchClient.searchCompanies({ name: entry.cleanedName }, targetFileType, { pagination: null });
        const data = Array.isArray(response?.data)
          ? response.data
          : Array.isArray(response?.items)
            ? response.items
            : [];
        candidatesMap.set(entry.normalizedName, data);
      } catch (error) {
        console.warn('[bid-result] search failed:', error);
        candidatesMap.set(entry.normalizedName, []);
      }
    }
    return candidatesMap;
  }, []);

  const formatWorkbookInBrowser = React.useCallback(async (file) => {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error('엑셀 시트를 찾을 수 없습니다.');

    const lastDataRow = findLastDataRow(worksheet);
    const preservedFonts = new Map();
    if (lastDataRow >= 14) {
      for (let row = 14; row <= lastDataRow; row += 1) {
        for (let col = 1; col <= 16; col += 1) {
          if (col === 4 || col === 5 || col === 16) continue;
          const font = worksheet.getCell(row, col).font;
          if (font) preservedFonts.set(`${row}:${col}`, cloneFont(font));
        }
      }
    }

    for (let row = 5; row <= 10; row += 1) {
      for (let col = 2; col <= 13; col += 1) {
        setFontSize(worksheet.getCell(row, col), 11);
      }
    }
    setFontSize(worksheet.getCell('B3'), 12);
    setFontSize(worksheet.getCell('K3'), 12);

    if (lastDataRow >= 14) {
      for (let row = 14; row <= lastDataRow; row += 1) {
        setFontSize(worksheet.getCell(row, 4), 12);
        setFontSize(worksheet.getCell(row, 5), 12);
        worksheet.getRow(row).height = 25;
      }
    }

    worksheet.getColumn('N').hidden = true;

    if (lastDataRow >= 15) {
      for (let row = 15; row <= lastDataRow; row += 1) {
        const cell = worksheet.getCell(row, 16);
        cell.value = { formula: `E${row}-E${row - 1}` };
        cell.numFmt = '#,##0';
        cell.font = { ...(cell.font || {}), size: 12, bold: true };
      }
    }

    autoFitDiffColumn(worksheet, Math.max(lastDataRow, worksheet.rowCount));
    worksheet.getColumn(15).width = 1.88;

    preservedFonts.forEach((font, key) => {
      const [row, col] = key.split(':').map(Number);
      worksheet.getCell(row, col).font = font;
    });

    workbook.calcProperties = {
      ...(workbook.calcProperties || {}),
      fullCalcOnLoad: true,
    };

    return workbook.xlsx.writeBuffer();
  }, []);

  const applyBidAmountTemplateInBrowser = React.useCallback(async ({ templateFile: file, entries, header }) => {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('투찰금액 템플릿 시트를 찾을 수 없습니다.');

    const qualityEntries = [];
    const tieEntries = [];
    const normalEntries = [];
    (entries || []).forEach((entry) => {
      if (entry.isTie) tieEntries.push(entry);
      else if (entry.isQuality) qualityEntries.push(entry);
      else normalEntries.push(entry);
    });
    const totalCount = entries.length;
    const slots = Array(totalCount).fill(null);
    const qualityCount = qualityEntries.length;
    const qualityStart = qualityCount > 0 ? Math.floor((totalCount - qualityCount) / 2) : 0;
    for (let i = 0; i < qualityCount; i += 1) {
      const slotIndex = qualityStart + i;
      if (slotIndex >= 0 && slotIndex < totalCount) slots[slotIndex] = qualityEntries[i];
    }
    let tieIndex = 0;
    for (let index = totalCount; index >= 1; index -= 1) {
      if (tieIndex >= tieEntries.length) break;
      const slotIndex = index - 1;
      if (!slots[slotIndex]) {
        slots[slotIndex] = tieEntries[tieIndex];
        tieIndex += 1;
      }
    }
    let normalIndex = 0;
    for (let index = 1; index <= totalCount; index += 1) {
      if (normalIndex >= normalEntries.length) break;
      const slotIndex = index - 1;
      if (!slots[slotIndex]) {
        slots[slotIndex] = normalEntries[normalIndex];
        normalIndex += 1;
      }
    }
    const ordered = slots.filter(Boolean);

    const lastRow = Math.max(
      findLastDataRow(sheet),
      (() => {
        const maxRow = Math.max(sheet.rowCount || 0, 8);
        let row = 7;
        for (let i = 8; i <= maxRow; i += 1) {
          if (getCellText(sheet.getCell(i, 3)).trim()) row = i;
        }
        return row;
      })(),
    );
    for (let row = 8; row <= lastRow; row += 1) {
      sheet.getCell(row, 2).value = null;
      sheet.getCell(row, 3).value = null;
      sheet.getCell(row, 7).value = null;
      applyCellFillStyle(sheet.getCell(row, 2), { type: 'pattern', pattern: 'none' });
    }

    const noticeNo = header.noticeNo ? String(header.noticeNo).trim() : '';
    const noticeTitle = header.noticeTitle ? String(header.noticeTitle).trim() : '';
    const ownerLabel = header.ownerLabel ? String(header.ownerLabel).trim() : '';
    const bidDeadline = header.bidDeadline ? String(header.bidDeadline).trim() : '';
    const baseAmount = header.baseAmount ? String(header.baseAmount).trim() : '';
    if (noticeNo) sheet.getCell('C1').value = noticeNo;
    if (noticeTitle) sheet.getCell('C2').value = noticeTitle;
    if (ownerLabel) sheet.getCell('C3').value = ownerLabel;
    if (bidDeadline) sheet.getCell('C4').value = bidDeadline;
    if (baseAmount) sheet.getCell('C5').value = baseAmount;

    ordered.forEach((entry, index) => {
      const row = 8 + index;
      sheet.getCell(row, 2).value = index + 1;
      sheet.getCell(row, 3).value = entry.name;
      if (entry.isQuality) {
        sheet.getCell(row, 7).value = '품질만점';
        applyCellFillStyle(sheet.getCell(row, 2), QUALITY_FILL);
      } else if (entry.isTie) {
        sheet.getCell(row, 7).value = '동가주의';
      }
    });

    const trimStartRow = 8 + ordered.length;
    if (sheet.rowCount >= trimStartRow) {
      const deleteCount = sheet.rowCount - trimStartRow + 1;
      if (deleteCount > 0) {
        sheet.spliceRows(trimStartRow, deleteCount);
      }
    }

    const output = await workbook.xlsx.writeBuffer();
    return {
      buffer: output,
      totalCount,
      qualityCount: qualityEntries.length,
      tieCount: tieEntries.length,
    };
  }, []);

  const applyAgreementInBrowser = React.useCallback(async ({ sourceFile, entries }) => {
    if (!sourceFile) throw new Error('개찰결과파일을 먼저 선택하세요.');
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error('협정파일에서 매칭할 사업자번호가 없습니다.');
    }

    const workbook = new ExcelJS.Workbook();
    const buffer = await sourceFile.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('개찰결과 파일 시트를 찾을 수 없습니다.');
    removeConditionalFormatting(sheet);

    const entryMap = new Map();
    entries.forEach((entry) => {
      const normalizedBiz = normalizeBizNumber(entry?.bizNo);
      if (!normalizedBiz || normalizedBiz.length !== 10) return;
      if (!entryMap.has(normalizedBiz)) {
        entryMap.set(normalizedBiz, Boolean(entry?.special));
        return;
      }
      const prevSpecial = entryMap.get(normalizedBiz);
      entryMap.set(normalizedBiz, Boolean(prevSpecial || entry?.special));
    });
    if (!entryMap.size) throw new Error('협정파일에서 유효한 사업자번호를 찾지 못했습니다.');

    const lastRow = findLastDataRow(sheet, 3);
    const matchedRows = new Set();
    const specialRows = new Set();
    for (let row = 14; row <= lastRow; row += 1) {
      const normalizedBiz = normalizeBizNumber(getCellText(sheet.getCell(row, 3)));
      if (!normalizedBiz || normalizedBiz.length !== 10) continue;
      if (!entryMap.has(normalizedBiz)) continue;
      matchedRows.add(row);
      if (entryMap.get(normalizedBiz)) specialRows.add(row);
    }

    matchedRows.forEach((row) => {
      applyCellFillStyle(
        sheet.getCell(row, 2),
        specialRows.has(row) ? AGREEMENT_SPECIAL_FILL : AGREEMENT_DEFAULT_FILL,
      );
    });

    const output = await workbook.xlsx.writeBuffer();
    return { buffer: output, matchedCount: matchedRows.size, scannedCount: entryMap.size };
  }, []);

  const applyOrderingInBrowser = React.useCallback(async ({ sourceFile, orderingFile }) => {
    if (!sourceFile) throw new Error('개찰결과파일을 먼저 선택하세요.');
    if (!orderingFile) throw new Error('발주처결과 파일을 먼저 선택하세요.');

    const orderingBuffer = await orderingFile.arrayBuffer();
    const orderingWorkbook = XLSX.read(orderingBuffer, { type: 'array', cellStyles: true });
    const orderingSheetName = (orderingWorkbook.SheetNames || []).find(
      (name) => name.replace(/\s+/g, '') === '입찰금액점수',
    );
    if (!orderingSheetName) throw new Error('발주처결과 파일에서 "입찰금액점수" 시트를 찾을 수 없습니다.');
    const orderingSheet = orderingWorkbook.Sheets[orderingSheetName];
    if (!orderingSheet) throw new Error('발주처결과 파일에서 "입찰금액점수" 시트를 찾을 수 없습니다.');
    const lowerName = String(orderingFile?.name || '').toLowerCase();
    let styleMap = null;
    let winnerRowsFromXml = [];
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm')) {
      try {
        const styleContext = await extractOrderingStyleContextFromXml(orderingBuffer, orderingSheetName);
        styleMap = styleContext?.styleMap || null;
        winnerRowsFromXml = Array.isArray(styleContext?.winnerRows) ? styleContext.winnerRows : [];
      } catch {
        styleMap = null;
      }
    }
    const parsedBase = readOrderingSheetData(orderingSheet, styleMap, winnerRowsFromXml);
    let validNumbers = parsedBase.validNumbers;
    let winnerInfos = Array.isArray(parsedBase.winnerInfos) ? [...parsedBase.winnerInfos] : [];
    console.log(
      '[bid-result:web] ordering parsed(xlsx) validNumbers:',
      validNumbers.size,
      'winners:',
      winnerInfos.length,
      'winnerSource:',
      parsedBase?.winnerSource || 'unknown',
    );
    console.log('[bid-result:web] ordering styles:', styleMap ? 'xlsx-style' : 'none/xls');
    if (winnerRowsFromXml.length > 0) {
      console.log('[bid-result:web] winner rows from xml:', winnerRowsFromXml);
    }
    if (winnerInfos.length === 0) {
      const styleDebug = collectOrderingStyleSamples(orderingSheet);
      console.log(
        '[bid-result:web] no winners from parser. yellowLikeCount:',
        styleDebug.yellowLikeCount,
        'style samples:',
        styleDebug.samples,
      );
    }
    console.log(
      '[bid-result:web] merged winners:',
      winnerInfos.length,
      'sample:',
      winnerInfos.slice(0, 10).map((info) => ({ row: info.sourceRow, bizNo: info.bizNo, rank: info.rank, name: info.companyName })),
    );
    if (!validNumbers.size) {
      throw new Error('발주처결과 파일에서 순번을 읽지 못했습니다. 입찰금액점수 시트의 순번(A열) 형식을 확인하세요.');
    }

    const workbook = new ExcelJS.Workbook();
    const sourceBuffer = await sourceFile.arrayBuffer();
    await workbook.xlsx.load(sourceBuffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('개찰결과 파일 시트를 찾을 수 없습니다.');

    const lastRow = findLastDataRow(sheet, 2);
    const invalidRows = new Set();
    for (let row = 14; row <= lastRow; row += 1) {
      const seq = normalizeSequence(getCellText(sheet.getCell(row, 2)));
      if (!seq) continue;
      if (!validNumbers.has(seq)) invalidRows.add(row);
    }

    const winnerRows = new Set();
    const matchedWinnerInfos = [];
    const unmatchedWinnerBizNos = [];
    winnerInfos.forEach((info) => {
      if (!info?.bizNo) return;
      let matched = false;
      for (let row = 14; row <= lastRow; row += 1) {
        const normalizedBiz = normalizeBizNumber(getCellText(sheet.getCell(row, 3)));
        if (normalizedBiz && normalizedBiz === info.bizNo) {
          winnerRows.add(row);
          matched = true;
          const templateName = getCellText(sheet.getCell(row, 4)).trim();
          if (templateName) info.companyName = templateName;
          if (!info.rank) {
            const templateRank = normalizeSequence(getCellText(sheet.getCell(row, 2)));
            if (templateRank) info.rank = templateRank;
          }
          matchedWinnerInfos.push({ ...info, templateRow: row });
          break;
        }
      }
      if (!matched) unmatchedWinnerBizNos.push(info.bizNo);
    });
    console.log(
      '[bid-result:web] winner match rows:',
      Array.from(winnerRows.values()),
      'unmatched bizNos:',
      unmatchedWinnerBizNos.slice(0, 20),
    );

    for (let row = 14; row <= lastRow; row += 1) {
      sheet.getCell(row, 15).value = null;
    }
    invalidRows.forEach((row) => {
      applyCellFillStyle(sheet.getCell(row, 2), ORDERING_INVALID_FILL);
    });
    winnerRows.forEach((row) => {
      sheet.getCell(row, 15).value = 'Y';
    });
    console.log('[bid-result:web] wrote Y count:', winnerRows.size);

    const b4 = sheet.getCell('B4');
    b4.value = `무효 ${invalidRows.size}건`;

    const k3Text = getCellText(sheet.getCell('K3'));
    const k4Prefix = buildActualWinnerLinePrefix(k3Text);
    const actualWinnerSummary = buildActualWinnerSummaryText(matchedWinnerInfos);
    if (actualWinnerSummary) {
      sheet.getCell('K4').value = `${k4Prefix} ${actualWinnerSummary}`.replace(/\s+/g, ' ').trim();
    } else if (k3Text) {
      sheet.getCell('K4').value = buildActualWinnerLinePrefix(k3Text);
    }

    const output = await workbook.xlsx.writeBuffer();
    return {
      buffer: output,
      invalidCount: invalidRows.size,
      winnerInfo: winnerInfos,
      winnerRow: winnerRows.size > 0 ? Array.from(winnerRows.values()) : null,
    };
  }, []);

  const handleTemplateFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setTemplateFile(file);
      setTemplatePath(file.path || file.name || '');
      notify({ type: 'info', message: '개찰결과파일이 변경되었습니다.' });
    } else {
      setTemplateFile(null);
      setTemplatePath('');
    }
  };

  const handlePickTemplateFile = () => {
    if (templateFileInputRef.current) {
      templateFileInputRef.current.click();
    }
  };

  const handleClearTemplateFile = () => {
    if (templateFileInputRef.current) {
      templateFileInputRef.current.value = '';
    }
    setTemplateFile(null);
    setTemplatePath('');
    notify({ type: 'info', message: '개찰결과파일 선택이 해제되었습니다.' });
  };

  const handleBidAmountTemplateUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setBidAmountTemplateFile(file);
      setBidAmountTemplatePath(file.path || file.name || '');
      notify({ type: 'info', message: '투찰금액 템플릿 파일이 변경되었습니다.' });
    } else {
      setBidAmountTemplateFile(null);
      setBidAmountTemplatePath('');
    }
  };

  const handlePickBidAmountTemplate = () => {
    if (bidAmountTemplateInputRef.current) {
      bidAmountTemplateInputRef.current.click();
    }
  };

  const handleClearBidAmountTemplate = () => {
    if (bidAmountTemplateInputRef.current) {
      bidAmountTemplateInputRef.current.value = '';
    }
    setBidAmountTemplateFile(null);
    setBidAmountTemplatePath('');
    notify({ type: 'info', message: '투찰금액 템플릿 선택이 해제되었습니다.' });
  };

  const handleFormatFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFormatFile(file);
    } else {
      setFormatFile(null);
    }
  };

  const handleClearFormatFile = React.useCallback(() => {
    if (formatFileInputRef.current) {
      formatFileInputRef.current.value = '';
    }
    setFormatFile(null);
  }, []);

  const handleRunBidAmountProcess = async () => {
    if (!bidAmountTemplatePath) {
      notify({ type: 'info', message: '투찰금액 템플릿 파일을 선택하세요.' });
      return;
    }
    if (!bidAmountOwnerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      return;
    }
    if (!bidAmountFileType) {
      notify({ type: 'info', message: '공종(전기/통신/소방)을 선택하세요.' });
      return;
    }
    if (!bidAmountAgreementFile) {
      notify({ type: 'info', message: '협정파일을 선택하세요.' });
      return;
    }
    if (!bidAmountSelectedAgreementSheet) {
      notify({ type: 'info', message: '협정파일 시트를 선택하세요.' });
      return;
    }
    setIsBidAmountProcessing(true);
    try {
      const { entries, excludedNames } = extractBidAmountEntries();
      if (!entries.length) throw new Error('협정파일에서 업체명을 찾지 못했습니다.');
      const candidatesMap = await findCompaniesForEntries(entries, bidAmountFileType);

      const conflictEntries = [];
      entries.forEach((entry) => {
        const normalized = entry.normalizedName;
        if (!normalized) return;
        const candidates = candidatesMap.get(normalized) || [];
        if (candidates.length <= 1) return;
        const savedKey = companyConflictSelections?.[normalized];
        const hasValidSelection = savedKey
          ? candidates.some((candidate) => buildCompanyOptionKey(candidate) === savedKey)
          : false;
        if (hasValidSelection) return;
        conflictEntries.push({
          normalizedName: normalized,
          displayName: entry.cleanedName || entry.rawName || normalized,
          options: candidates,
        });
      });

      if (conflictEntries.length > 0) {
        setPendingBidAmountEntries(entries);
        setPendingBidAmountExcluded(excludedNames);
        setPendingCandidatesMap(candidatesMap);
        setPendingConflictAction('bid-amount');
        setCompanyConflictModal({ open: true, entries: conflictEntries, isResolving: false });
        setIsBidAmountProcessing(false);
        return;
      }

      const bidEntries = buildBidAmountEntries(entries, candidatesMap, companyConflictSelections);
      if (!bidEntries.length) throw new Error('조회된 업체명이 없습니다.');
      const deadlineParts = [bidAmountDeadlineDate];
      if (bidAmountDeadlineTime) {
        deadlineParts.push(bidAmountDeadlinePeriod === 'PM' ? '오후' : '오전');
        deadlineParts.push(bidAmountDeadlineTime);
      }
      if (!bidAmountTemplateFile) {
        throw new Error('투찰금액 템플릿 파일을 다시 선택하세요.');
      }
      const result = await applyBidAmountTemplateInBrowser({
        templateFile: bidAmountTemplateFile,
        entries: bidEntries,
        header: {
          noticeNo: bidAmountNoticeNo,
          noticeTitle: bidAmountNoticeTitle,
          ownerLabel: bidAmountOwnerLabel,
          bidDeadline: deadlineParts.filter(Boolean).join(' '),
          baseAmount: bidAmountBaseAmount,
        },
      });
      const total = result.totalCount;
      const quality = result.qualityCount;
      const tie = result.tieCount;
      const baseName = sanitizeDownloadName(bidAmountTemplateFile.name || '투찰금액_템플릿.xlsx', '투찰금액_템플릿.xlsx').replace(/\.xlsx$/i, '');
      const fileName = `${baseName}_배치완료.xlsx`;
      downloadBlob(
        new Blob([result.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName,
      );
      const parts = [];
      if (total !== null) parts.push(`총 ${total}개`);
      if (quality !== null) parts.push(`품질만점 ${quality}개`);
      if (tie !== null) parts.push(`동가주의 ${tie}개`);
      const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      const missingSummary = summarizeMissingEntries(entries, candidatesMap);
      notify({ type: 'success', message: `투찰금액 템플릿 처리 완료${summary}` });
      if (missingSummary) {
        notify({
          type: 'info',
          duration: 0,
          message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
        });
      }
      if (excludedNames.length > 0) {
        notify({
          type: 'info',
          duration: 0,
          message: `담당자 제외 업체 (${excludedNames.length}개): ${excludedNames.join(', ')}`,
        });
      }
    } catch (err) {
      notify({ type: 'error', message: err?.message || '투찰금액 템플릿 처리에 실패했습니다.' });
    } finally {
      setIsBidAmountProcessing(false);
    }
  };

  const handleFormatWorkbook = async () => {
    if (!formatFile) {
      notify({ type: 'info', message: '엑셀 파일을 선택하세요.' });
      return;
    }
    setIsFormatting(true);
    try {
      const outputBuffer = await formatWorkbookInBrowser(formatFile);
      const baseName = sanitizeDownloadName(formatFile.name || '개찰결과파일.xlsx', '개찰결과파일.xlsx').replace(/\.xlsx$/i, '');
      const outputName = `${baseName}_서식변환.xlsx`;
      const outputBlob = new Blob([outputBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const nextTemplateFile = new File([outputBlob], outputName, { type: outputBlob.type });
      setTemplateFile(nextTemplateFile);
      setTemplatePath(outputName);
      downloadBlob(outputBlob, outputName);
      notify({ type: 'success', message: `변환이 완료되었습니다. (${outputName})` });
    } catch (err) {
      notify({ type: 'error', message: err.message || '엑셀 서식 변환에 실패했습니다.' });
    } finally {
      setIsFormatting(false);
    }
  };

  const handleBidAmountAgreementFileUpload = (event) => {
    if (!bidAmountOwnerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      if (event?.target) event.target.value = '';
      return;
    }
    if (!bidAmountFileType) {
      notify({ type: 'info', message: '공종을 먼저 선택하세요.' });
      if (event?.target) event.target.value = '';
      return;
    }
    const file = event.target.files[0];
    if (file) {
      setBidAmountAgreementFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        setBidAmountAgreementWorkbook(workbook);
        setBidAmountAgreementSheetNames(workbook.SheetNames || []);
        setBidAmountSelectedAgreementSheet(workbook.SheetNames?.[0] || '');
      };
      reader.readAsArrayBuffer(file);
    } else {
      setBidAmountAgreementFile(null);
      setBidAmountAgreementWorkbook(null);
      setBidAmountAgreementSheetNames([]);
      setBidAmountSelectedAgreementSheet('');
    }
  };

  const handleAgreementFileUpload = (event) => {
    if (!ownerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      if (event?.target) event.target.value = '';
      return;
    }
    if (!fileType) {
      notify({ type: 'info', message: '공종을 먼저 선택하세요.' });
      if (event?.target) event.target.value = '';
      return;
    }
    const file = event.target.files[0];
    if (file) {
      setAgreementFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        setAgreementWorkbook(workbook);
        setAgreementSheetNames(workbook.SheetNames || []);
        setSelectedAgreementSheet(workbook.SheetNames?.[0] || '');
      };
      reader.readAsArrayBuffer(file);
    } else {
      setAgreementFile(null);
      setAgreementWorkbook(null);
      setAgreementSheetNames([]);
      setSelectedAgreementSheet('');
    }
  };

  const handleOrderingResultUpload = (event) => {
    if (!ownerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      if (event?.target) event.target.value = '';
      return;
    }
    const file = event.target.files[0];
    if (file) {
      setOrderingResultFile(file);
    } else {
      setOrderingResultFile(null);
    }
  };

  const handleClearAgreementFile = React.useCallback(() => {
    if (agreementFileInputRef.current) {
      agreementFileInputRef.current.value = '';
    }
    setAgreementFile(null);
    setAgreementWorkbook(null);
    setAgreementSheetNames([]);
    setSelectedAgreementSheet('');
  }, []);

  const handleClearBidAmountAgreementFile = React.useCallback(() => {
    if (agreementPickerInputRef.current) {
      agreementPickerInputRef.current.value = '';
    }
    setBidAmountAgreementFile(null);
    setBidAmountAgreementWorkbook(null);
    setBidAmountAgreementSheetNames([]);
    setBidAmountSelectedAgreementSheet('');
  }, []);

  const handleClearOrderingFile = React.useCallback(() => {
    if (orderingFileInputRef.current) {
      orderingFileInputRef.current.value = '';
    }
    setOrderingResultFile(null);
  }, []);

  const handleAgreementSheetSelect = (event) => {
    setSelectedAgreementSheet(event.target.value);
  };
  const handleBidAmountAgreementSheetSelect = (event) => {
    setBidAmountSelectedAgreementSheet(event.target.value);
  };

  const handleOwnerChange = React.useCallback((value) => {
    setOwnerId(value);
    setOrderingResultFile(null);
    if (orderingFileInputRef.current) orderingFileInputRef.current.value = '';
  }, []);

  const handleBidAmountOwnerChange = React.useCallback((value) => {
    setBidAmountOwnerId(value);
    handleClearBidAmountAgreementFile();
  }, [handleClearBidAmountAgreementFile]);

  const handleBidAmountFileTypeChange = React.useCallback((value) => {
    setBidAmountFileType(value);
    handleClearBidAmountAgreementFile();
  }, [handleClearBidAmountAgreementFile]);

  const handlePickAgreementFile = () => {
    if (!bidAmountOwnerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      return;
    }
    if (!bidAmountFileType) {
      notify({ type: 'info', message: '공종을 먼저 선택하세요.' });
      return;
    }
    if (agreementPickerInputRef.current) {
      agreementPickerInputRef.current.click();
      return;
    }
    if (agreementFileInputRef.current) {
      agreementFileInputRef.current.click();
    }
  };

  const extractAgreementEntries = React.useCallback(() => {
    if (!agreementWorkbook || !selectedAgreementSheet) return [];
    const sheet = agreementWorkbook.Sheets?.[selectedAgreementSheet];
    if (!sheet) return [];
    const entries = [];
    const isLhOwner = ownerId === 'LH';
    const maxConsecutiveEmptyRows = isLhOwner ? 2 : 1;
    let consecutiveEmptyRows = 0;
    for (let row = 5; row <= 1000; row += 1) {
      const checkAddress = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
      const checkCell = sheet[checkAddress];
      const checkValue = checkCell ? XLSX.utils.format_cell(checkCell) : '';
      const hasCheck = String(checkValue || '').trim() !== '';
      if (!hasCheck) {
        consecutiveEmptyRows += 1;
        if (!isLhOwner || consecutiveEmptyRows >= maxConsecutiveEmptyRows) break;
        continue;
      }
      consecutiveEmptyRows = 0;
      const nameAddress = XLSX.utils.encode_cell({ r: row - 1, c: 2 });
      const nameCell = sheet[nameAddress];
      const raw = nameCell ? XLSX.utils.format_cell(nameCell) : '';
      const rawName = String(raw || '').trim();
      if (!rawName) continue;
      const cleaned = cleanCompanyName(rawName);
      if (!cleaned) continue;
      entries.push({
        rawName,
        cleanedName: cleaned,
        normalizedName: normalizeName(cleaned),
        special: hasSpecialName(rawName),
      });
    }
    return entries;
  }, [agreementWorkbook, selectedAgreementSheet, ownerId]);

  const extractBidAmountEntries = React.useCallback(() => {
    if (!bidAmountAgreementWorkbook || !bidAmountSelectedAgreementSheet) return { entries: [], excludedNames: [] };
    const sheet = bidAmountAgreementWorkbook.Sheets?.[bidAmountSelectedAgreementSheet];
    if (!sheet) return { entries: [], excludedNames: [] };
    const entries = [];
    const excludedNames = [];
    const isLhOwner = bidAmountOwnerId === 'LH';
    const maxConsecutiveEmptyRows = isLhOwner ? 2 : 1;
    let consecutiveEmptyRows = 0;
    for (let row = 5; row <= 1000; row += 1) {
      const checkAddress = XLSX.utils.encode_cell({ r: row - 1, c: 0 });
      const checkCell = sheet[checkAddress];
      const checkValue = checkCell ? XLSX.utils.format_cell(checkCell) : '';
      const hasCheck = String(checkValue || '').trim() !== '';
      if (!hasCheck) {
        consecutiveEmptyRows += 1;
        if (!isLhOwner || consecutiveEmptyRows >= maxConsecutiveEmptyRows) break;
        continue;
      }
      consecutiveEmptyRows = 0;
      const nameAddress = XLSX.utils.encode_cell({ r: row - 1, c: 2 });
      const nameCell = sheet[nameAddress];
      const raw = nameCell ? XLSX.utils.format_cell(nameCell) : '';
      const rawName = String(raw || '').trim();
      if (!rawName) continue;
      if (hasSpecialName(rawName)) {
        const cleaned = cleanCompanyName(rawName);
        excludedNames.push(cleaned || rawName);
        continue;
      }
      const cleaned = cleanCompanyName(rawName);
      if (!cleaned) continue;
      const remarkAddress = XLSX.utils.encode_cell({ r: row - 1, c: 7 });
      const remarkCell = sheet[remarkAddress];
      const rawRemark = remarkCell ? XLSX.utils.format_cell(remarkCell) : '';
      const remark = String(rawRemark || '').trim();
      const normalizedRemark = remark.replace(/\s+/g, '');
      const isQuality = normalizedRemark.includes('품질만점');
      const isTie = normalizedRemark.includes('동가주의');
      entries.push({
        rawName,
        cleanedName: cleaned,
        normalizedName: normalizeName(cleaned),
        remark,
        isQuality,
        isTie,
      });
    }
    return { entries, excludedNames };
  }, [bidAmountAgreementWorkbook, bidAmountSelectedAgreementSheet, bidAmountOwnerId]);

  const buildBizEntries = React.useCallback((entries, candidatesMap, selections) => {
    const bizEntries = [];
    entries.forEach((entry) => {
      const normalizedName = entry.normalizedName;
      if (!normalizedName) return;
      const candidates = candidatesMap.get(normalizedName) || [];
      if (!candidates.length) return;
      let picked = null;
      if (candidates.length === 1) {
        picked = candidates[0];
      } else {
        const savedKey = selections?.[normalizedName];
        if (!savedKey) return;
        picked = candidates.find((candidate) => buildCompanyOptionKey(candidate) === savedKey) || null;
        if (!picked) return;
      }
      const bizNo = pickFirstValue(picked, BIZ_FIELDS);
      const normalizedBiz = normalizeBizNumber(bizNo);
      if (!normalizedBiz || normalizedBiz.length !== 10) return;
      bizEntries.push({ bizNo: normalizedBiz, special: entry.special });
    });
    return bizEntries;
  }, []);

  const buildBidAmountEntries = React.useCallback((entries, candidatesMap, selections) => (
    (entries || []).map((entry) => {
      const normalizedName = entry.normalizedName;
      const candidates = normalizedName ? (candidatesMap.get(normalizedName) || []) : [];
      if (!normalizedName || candidates.length === 0) return null;
      let picked = null;
      if (candidates.length === 1) {
        picked = candidates[0];
      } else {
        const savedKey = selections?.[normalizedName];
        if (!savedKey) return null;
        picked = candidates.find((candidate) => buildCompanyOptionKey(candidate) === savedKey) || null;
        if (!picked) return null;
      }
      const resolvedName = String(pickFirstValue(picked, NAME_FIELDS) || entry.cleanedName || entry.rawName || '').trim();
      if (!resolvedName) return null;
      return {
        name: resolvedName,
        isQuality: Boolean(entry.isQuality),
        isTie: Boolean(entry.isTie),
      };
    }).filter(Boolean)
  ), []);

  const handleCompanyConflictPick = (normalizedName, option) => {
    const key = buildCompanyOptionKey(option);
    setCompanyConflictSelections((prev) => ({ ...prev, [normalizedName]: key }));
  };

  const handleCompanyConflictCancel = () => {
    setCompanyConflictModal({ open: false, entries: [], isResolving: false });
    setPendingConflictAction(null);
    setPendingAgreementEntries(null);
    setPendingBidAmountEntries(null);
    setPendingBidAmountExcluded([]);
    setPendingCandidatesMap(null);
  };

  const handleCompanyConflictConfirm = async () => {
    if (!pendingCandidatesMap || !pendingConflictAction) {
      handleCompanyConflictCancel();
      return;
    }
    if (pendingConflictAction === 'agreement' && !pendingAgreementEntries) {
      handleCompanyConflictCancel();
      return;
    }
    if (pendingConflictAction === 'bid-amount' && !pendingBidAmountEntries) {
      handleCompanyConflictCancel();
      return;
    }
    const missingSelections = (companyConflictModal.entries || []).filter((entry) => {
      const savedKey = companyConflictSelections?.[entry.normalizedName];
      if (!savedKey) return true;
      const candidates = pendingCandidatesMap.get(entry.normalizedName) || [];
      return !candidates.some((candidate) => buildCompanyOptionKey(candidate) === savedKey);
    });
    if (missingSelections.length > 0) {
      notify({ type: 'info', message: '중복된 업체가 있습니다. 모든 항목을 선택해 주세요.' });
      return;
    }
    setCompanyConflictModal((prev) => ({ ...prev, isResolving: true }));
    try {
      if (pendingConflictAction === 'bid-amount') {
        const bidEntries = buildBidAmountEntries(pendingBidAmountEntries, pendingCandidatesMap, companyConflictSelections);
        if (!bidEntries.length) throw new Error('조회된 업체명이 없습니다.');
        const deadlineParts = [bidAmountDeadlineDate];
        if (bidAmountDeadlineTime) {
          deadlineParts.push(bidAmountDeadlinePeriod === 'PM' ? '오후' : '오전');
          deadlineParts.push(bidAmountDeadlineTime);
        }
        if (!bidAmountTemplateFile) {
          throw new Error('투찰금액 템플릿 파일을 다시 선택하세요.');
        }
        const result = await applyBidAmountTemplateInBrowser({
          templateFile: bidAmountTemplateFile,
          entries: bidEntries,
          header: {
            noticeNo: bidAmountNoticeNo,
            noticeTitle: bidAmountNoticeTitle,
            ownerLabel: bidAmountOwnerLabel,
            bidDeadline: deadlineParts.filter(Boolean).join(' '),
            baseAmount: bidAmountBaseAmount,
          },
        });
        const total = result.totalCount;
        const quality = result.qualityCount;
        const tie = result.tieCount;
        const baseName = sanitizeDownloadName(bidAmountTemplateFile.name || '투찰금액_템플릿.xlsx', '투찰금액_템플릿.xlsx').replace(/\.xlsx$/i, '');
        const fileName = `${baseName}_배치완료.xlsx`;
        downloadBlob(
          new Blob([result.buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
          fileName,
        );
        const parts = [];
        if (total !== null) parts.push(`총 ${total}개`);
        if (quality !== null) parts.push(`품질만점 ${quality}개`);
        if (tie !== null) parts.push(`동가주의 ${tie}개`);
        const summary = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        const missingSummary = summarizeMissingEntries(pendingBidAmountEntries, pendingCandidatesMap);
        notify({ type: 'success', message: `투찰금액 템플릿 처리 완료${summary}` });
        if (missingSummary) {
          notify({
            type: 'info',
            duration: 0,
            message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
          });
        }
        if (pendingBidAmountExcluded.length > 0) {
          notify({
            type: 'info',
            duration: 0,
            message: `담당자 제외 업체 (${pendingBidAmountExcluded.length}개): ${pendingBidAmountExcluded.join(', ')}`,
          });
        }
      } else {
        const bizEntries = buildBizEntries(pendingAgreementEntries, pendingCandidatesMap, companyConflictSelections);
        if (!bizEntries.length) throw new Error('조회된 사업자번호가 없습니다.');
        if (!templateFile) throw new Error('개찰결과파일을 다시 선택하세요.');
        const result = await applyAgreementInBrowser({
          sourceFile: templateFile,
          entries: bizEntries,
        });
        saveProcessedTemplate(result.buffer, '협정체크');
        const matched = Number.isFinite(result?.matchedCount) ? result.matchedCount : null;
        const scanned = Number.isFinite(result?.scannedCount) ? result.scannedCount : null;
        const summary = matched !== null && scanned !== null
          ? ` (매칭 ${matched}/${scanned})`
          : '';
        const missingSummary = summarizeMissingEntries(pendingAgreementEntries, pendingCandidatesMap);
        notify({ type: 'success', message: `협정파일 처리 완료: 개찰결과파일에 색상이 반영되었습니다.${summary}` });
        if (missingSummary) {
          notify({
            type: 'info',
            duration: 0,
            message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
          });
        }
      }
      setCompanyConflictModal({ open: false, entries: [], isResolving: false });
      setPendingConflictAction(null);
      setPendingAgreementEntries(null);
      setPendingBidAmountEntries(null);
      setPendingBidAmountExcluded([]);
      setPendingCandidatesMap(null);
    } catch (err) {
      notify({ type: 'error', message: err?.message || '협정파일 처리에 실패했습니다.' });
      setCompanyConflictModal((prev) => ({ ...prev, isResolving: false }));
    }
  };

  const handleRunAgreementProcess = async () => {
    if (!ownerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      return;
    }
    if (!templatePath) {
      notify({ type: 'info', message: '먼저 템플릿 파일을 서식 변환으로 생성하세요.' });
      return;
    }
    if (!agreementFile) {
      notify({ type: 'info', message: '협정파일을 선택하세요.' });
      return;
    }
    if (!selectedAgreementSheet) {
      notify({ type: 'info', message: '협정파일 시트를 선택하세요.' });
      return;
    }
    if (!fileType) {
      notify({ type: 'info', message: '공종(전기/통신/소방)을 선택하세요.' });
      return;
    }
    if (!templateFile) {
      notify({ type: 'info', message: '개찰결과파일을 먼저 선택하세요.' });
      return;
    }
    setIsAgreementProcessing(true);
    try {
      const entries = extractAgreementEntries();
      if (!entries.length) throw new Error('협정파일에서 업체명을 찾지 못했습니다.');
      const candidatesMap = await findCompaniesForEntries(entries, fileType);

      const conflictEntries = [];
      entries.forEach((entry) => {
        const normalized = entry.normalizedName;
        if (!normalized) return;
        const candidates = candidatesMap.get(normalized) || [];
        if (candidates.length <= 1) return;
        const savedKey = companyConflictSelections?.[normalized];
        const hasValidSelection = savedKey
          ? candidates.some((candidate) => buildCompanyOptionKey(candidate) === savedKey)
          : false;
        if (hasValidSelection) return;
        conflictEntries.push({
          normalizedName: normalized,
          displayName: entry.cleanedName || entry.rawName || normalized,
          options: candidates,
        });
      });

      if (conflictEntries.length > 0) {
        setPendingAgreementEntries(entries);
        setPendingCandidatesMap(candidatesMap);
        setPendingConflictAction('agreement');
        setCompanyConflictModal({ open: true, entries: conflictEntries, isResolving: false });
        setIsAgreementProcessing(false);
        return;
      }

      const bizEntries = buildBizEntries(entries, candidatesMap, companyConflictSelections);
      const missingSummary = summarizeMissingEntries(entries, candidatesMap);
      if (!bizEntries.length) throw new Error('조회된 사업자번호가 없습니다.');

      const result = await applyAgreementInBrowser({
        sourceFile: templateFile,
        entries: bizEntries,
      });
      saveProcessedTemplate(result.buffer, '협정체크');
      const matched = Number.isFinite(result?.matchedCount) ? result.matchedCount : null;
      const scanned = Number.isFinite(result?.scannedCount) ? result.scannedCount : null;
      const summary = matched !== null && scanned !== null
        ? ` (매칭 ${matched}/${scanned})`
        : '';
      notify({ type: 'success', message: `협정파일 처리 완료: 개찰결과파일에 색상이 반영되었습니다.${summary}` });
      if (missingSummary) {
        notify({
          type: 'info',
          duration: 0,
          message: `협정파일 업체 ${missingSummary.totalCount}개 중 ${missingSummary.missingCount}개는 DB에서 찾지 못해 제외되었습니다.\n제외 업체: ${missingSummary.missingNames.join(', ')}`,
        });
      }
    } catch (err) {
      notify({ type: 'error', message: err?.message || '협정파일 처리에 실패했습니다.' });
    } finally {
      setIsAgreementProcessing(false);
    }
  };

  const handleRunOrderingProcess = async () => {
    if (!ownerId) {
      notify({ type: 'info', message: '발주처를 먼저 선택하세요.' });
      return;
    }
    if (!templatePath) {
      notify({ type: 'info', message: '먼저 템플릿 파일을 서식 변환으로 생성하세요.' });
      return;
    }
    if (!orderingResultFile) {
      notify({ type: 'info', message: '발주처결과 파일을 선택하세요.' });
      return;
    }
    if (!templateFile) {
      notify({ type: 'info', message: '개찰결과파일을 먼저 선택하세요.' });
      return;
    }
    const orderingFileName = String(orderingResultFile?.name || orderingResultFile?.path || '').trim();
    const isLegacyXls = /\.xls$/i.test(orderingFileName) && !/\.xlsx$/i.test(orderingFileName);
    if (isLegacyXls) {
      const proceedWithXls = await confirm({
        title: '발주처결과 파일 형식 안내',
        message: '현재 업로드한 파일은 무효표 체크만 가능합니다. 실제낙찰사 표시를 하려면 xlsx 파일을 업로드하세요. 그래도 진행하시겠습니까?',
        confirmText: '예',
        cancelText: '아니오',
        tone: 'warning',
      });
      if (!proceedWithXls) return;
    }
    const confirmed = await confirm({
      title: '발주처 결과 확인',
      message: '발주처 결과 파일에 실제낙찰사를 표시 하였습니까?',
      confirmText: '예',
      cancelText: '아니오',
    });
    if (!confirmed) return;
    setIsOrderingProcessing(true);
    try {
      const response = await applyOrderingInBrowser({
        sourceFile: templateFile,
        orderingFile: orderingResultFile,
      });
      saveProcessedTemplate(response.buffer, '발주처결과');
      const invalidCount = Number.isFinite(response?.invalidCount) ? response.invalidCount : null;
      const summary = invalidCount !== null ? ` (무효 ${invalidCount}건)` : '';
      const winnerInfo = response?.winnerInfo;
      const winnerList = Array.isArray(winnerInfo) ? winnerInfo : (winnerInfo ? [winnerInfo] : []);
      const winnerSummaryText = buildActualWinnerSummaryText(winnerList);
      const winnerSummary = winnerSummaryText
        ? ` 실제낙찰사: ${winnerSummaryText}`
        : '';
      notify({ type: 'success', message: `발주처결과 처리 완료: 무효 업체가 표시되었습니다.${summary}${winnerSummary}` });
    } catch (err) {
      notify({ type: 'error', message: err?.message || '발주처결과 처리에 실패했습니다.' });
    } finally {
      setIsOrderingProcessing(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active="bid-result" onSelect={handleSidebarSelect} fileStatuses={{}} collapsed={true} />
      <div className="main">
        <div className="title-drag" />
        <div className="topbar" />
        <div className="stage excel-helper-stage">
          <div className="excel-helper-shell">
            <h1 className="excel-helper-title">개찰결과 도우미</h1>
            <div className="excel-helper-body">
              <section className="excel-helper-section">
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                  <div style={{ ...sectionCardStyle, flex: '1 1 360px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={sectionTitleBadgeStyle}>개찰결과 엑셀 크기 및 폰트 수정</span>
                    </div>
                    <p className="section-help">업로드한 엑셀 파일의 서식/수식을 자동으로 정리합니다. (B열 순번 기준으로 마지막 행까지 적용)</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>엑셀 파일 선택</label>
                        <input
                          type="file"
                          className="input"
                          accept=".xlsx"
                          ref={formatFileInputRef}
                          onChange={handleFormatFileUpload}
                          onClick={(e) => { e.target.value = ''; }}
                        />
                        <button
                          type="button"
                          className="btn-soft"
                          style={{ marginTop: '8px' }}
                          onClick={handleClearFormatFile}
                          disabled={!formatFile}
                        >
                          업로드 파일 지우기
                        </button>
                        {formatFile && (
                          <p className="section-help" style={{ marginTop: 8 }}>
                            선택된 파일: {formatFile.name}
                          </p>
                        )}
                      </div>
                      <div className="excel-helper-actions">
                        <button
                          type="button"
                          className="primary"
                          onClick={handleFormatWorkbook}
                          disabled={isFormatting}
                          style={{ minWidth: '180px' }}
                        >
                          {isFormatting ? '변환 중...' : '서식 변환'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ ...sectionCardStyle, flex: '1 1 360px' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <span style={sectionTitleBadgeStyle}>투찰금액 템플릿 업체 배치</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>공고번호</label>
                          <input
                            className="input"
                            value={bidAmountNoticeNo}
                            onChange={(event) => setBidAmountNoticeNo(event.target.value)}
                            placeholder="예: R26BK..."
                          />
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>공사명</label>
                          <input
                            className="input"
                            value={bidAmountNoticeTitle}
                            onChange={(event) => setBidAmountNoticeTitle(event.target.value)}
                            style={{ minWidth: '420px', width: '100%' }}
                            placeholder="공사명을 입력하세요"
                          />
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>발주처</label>
                          <select
                            className="input"
                            value={bidAmountOwnerId}
                            onChange={(event) => handleBidAmountOwnerChange(event.target.value)}
                          >
                            <option value="" disabled hidden>발주처를 선택하세요</option>
                            {OWNER_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>공종</label>
                          <select
                            className="input"
                            value={bidAmountFileType}
                            onChange={(event) => handleBidAmountFileTypeChange(event.target.value)}
                          >
                            <option value="" disabled hidden>공종을 선택하세요</option>
                            {FILE_TYPE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>투찰마감일</label>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <input
                              className="input"
                              type="date"
                              value={bidAmountDeadlineDate}
                              onChange={(event) => setBidAmountDeadlineDate(event.target.value)}
                            />
                            <select
                              className="input"
                              value={bidAmountDeadlinePeriod}
                              onChange={(event) => setBidAmountDeadlinePeriod(event.target.value)}
                            >
                              <option value="AM">오전</option>
                              <option value="PM">오후</option>
                            </select>
                            <input
                              className="input"
                              type="text"
                              inputMode="numeric"
                              value={bidAmountDeadlineTime}
                              onChange={(event) => setBidAmountDeadlineTime(event.target.value)}
                              placeholder="예: 10:30"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>기초금액</label>
                          <input
                            className="input"
                            value={bidAmountBaseAmount}
                            onChange={(event) => setBidAmountBaseAmount(event.target.value)}
                            placeholder="예: 2,550,405,000"
                          />
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>투찰금액 템플릿</label>
                          <input
                            type="file"
                            accept=".xlsx"
                            ref={bidAmountTemplateInputRef}
                            onChange={handleBidAmountTemplateUpload}
                            onClick={(e) => { e.target.value = ''; }}
                            style={{ display: 'none' }}
                          />
                          <div className="input" style={{ fontWeight: 700 }}>
                            {bidAmountTemplateName || '투찰금액 템플릿을 선택하세요.'}
                          </div>
                          {bidAmountTemplatePath && (
                            <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                              {bidAmountTemplatePath}
                            </p>
                          )}
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handlePickBidAmountTemplate}
                          >
                            템플릿 선택
                          </button>
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handleClearBidAmountTemplate}
                            disabled={!bidAmountTemplatePath}
                          >
                            선택 해제
                          </button>
                        </div>
                        <div>
                          <label className="field-label" style={strongLabelStyle}>협정파일 정보</label>
                          <input
                            type="file"
                            accept=".xlsx"
                            ref={agreementPickerInputRef}
                            onChange={handleBidAmountAgreementFileUpload}
                            onClick={(e) => { e.target.value = ''; }}
                            style={{ display: 'none' }}
                          />
                          <div className="input" style={{ fontWeight: 700 }}>
                            {bidAmountAgreementFile?.name || '협정파일을 선택하세요.'}
                          </div>
                          <p className="section-help" style={{ marginTop: 6 }}>
                            시트: {bidAmountSelectedAgreementSheet || '선택 안 함'}
                          </p>
                          <select
                            className="input"
                            value={bidAmountSelectedAgreementSheet}
                            onChange={handleBidAmountAgreementSheetSelect}
                            disabled={bidAmountAgreementSheetNames.length === 0}
                            style={{ marginTop: '8px' }}
                          >
                            <option value="">시트를 선택하세요</option>
                            {bidAmountAgreementSheetNames.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          {(!bidAmountOwnerId || !bidAmountFileType) && (
                            <p className="section-help" style={{ marginTop: 8 }}>
                              발주처와 공종을 먼저 선택하면 협정파일 선택이 가능합니다.
                            </p>
                          )}
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handlePickAgreementFile}
                          >
                            협정파일 선택
                          </button>
                          <button
                            type="button"
                            className="btn-soft"
                            style={{ marginTop: '8px' }}
                            onClick={handleClearBidAmountAgreementFile}
                            disabled={!bidAmountAgreementFile}
                          >
                            선택 해제
                          </button>
                        </div>
                        <div className="excel-helper-actions">
                          <button
                            type="button"
                            className="primary"
                            onClick={handleRunBidAmountProcess}
                            disabled={isBidAmountProcessing}
                            style={{ minWidth: '180px' }}
                          >
                            {isBidAmountProcessing ? '처리 중...' : '배치 실행'}
                          </button>
                        </div>
                      </div>
                    </div>
                </div>
                <>
                  <div style={{ height: '16px' }} />
                  <div style={sectionCardStyle}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={sectionTitleBadgeStyle}>개찰결과 엑셀에 협정 업체 체크</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>개찰결과파일</label>
                        <input
                          type="file"
                          accept=".xlsx"
                          ref={templateFileInputRef}
                          onChange={handleTemplateFileUpload}
                          onClick={(e) => { e.target.value = ''; }}
                          style={{ display: 'none' }}
                        />
                        <div className="input" style={{ fontWeight: 700 }}>
                          {templateFileName || '템플릿을 먼저 생성하세요.'}
                        </div>
                        {templatePath && (
                          <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                            {templatePath}
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn-soft"
                          style={{ marginTop: '8px' }}
                          onClick={handlePickTemplateFile}
                        >
                          개찰결과파일 변경
                        </button>
                        <button
                          type="button"
                          className="btn-soft"
                          style={{ marginTop: '8px' }}
                          onClick={handleClearTemplateFile}
                          disabled={!templatePath}
                        >
                          업로드 파일 지우기
                        </button>
                      </div>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>발주처</label>
                        <select
                          className="input"
                          value={ownerId}
                          onChange={(event) => handleOwnerChange(event.target.value)}
                        >
                          <option value="" disabled hidden>발주처를 선택하세요</option>
                          {OWNER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>공종</label>
                        <select
                          className="input"
                          value={fileType}
                          onChange={(event) => {
                            setFileType(event.target.value);
                            setAgreementFile(null);
                            setAgreementWorkbook(null);
                            setAgreementSheetNames([]);
                            setSelectedAgreementSheet('');
                            if (agreementFileInputRef.current) agreementFileInputRef.current.value = '';
                          }}
                        >
                          <option value="" disabled hidden>공종을 선택하세요</option>
                          {FILE_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>협정파일 업로드</label>
                        <input
                          type="file"
                          className="input"
                          accept=".xlsx"
                          ref={agreementFileInputRef}
                          onChange={handleAgreementFileUpload}
                          onClick={(e) => { e.target.value = ''; }}
                          disabled={!ownerId || !fileType}
                        />
                        {(!ownerId || !fileType) && (
                          <p className="section-help" style={{ marginTop: 8 }}>
                            발주처와 공종을 먼저 선택하면 파일 업로드가 가능합니다.
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn-soft"
                          style={{ marginTop: '8px' }}
                          onClick={handleClearAgreementFile}
                          disabled={!agreementFile}
                        >
                          업로드 파일 지우기
                        </button>
                        {agreementFile && (
                          <p className="section-help" style={{ marginTop: 8 }}>
                            선택된 파일: {agreementFile.name}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>협정파일 시트 선택</label>
                        <select
                          className="input"
                          value={selectedAgreementSheet}
                          onChange={handleAgreementSheetSelect}
                          disabled={agreementSheetNames.length === 0}
                        >
                          <option value="">시트를 선택하세요</option>
                          {agreementSheetNames.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="excel-helper-actions">
                        <button
                          type="button"
                          className="primary"
                          onClick={handleRunAgreementProcess}
                          disabled={isAgreementProcessing || !ownerId || !fileType}
                          style={{ minWidth: '180px' }}
                        >
                          {isAgreementProcessing ? '처리 중...' : '협정 실행'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: '16px' }} />
                  <div style={sectionCardStyle}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={sectionTitleBadgeStyle}>개찰결과 엑셀에 무효표, 실제낙찰사 표시</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>발주처</label>
                        <select
                          className="input"
                          value={ownerId}
                          onChange={(event) => handleOwnerChange(event.target.value)}
                        >
                          <option value="" disabled hidden>발주처를 선택하세요</option>
                          {OWNER_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>개찰결과파일</label>
                        <div className="input" style={{ fontWeight: 700 }}>
                          {templateFileName || '템플릿을 먼저 생성하세요.'}
                        </div>
                        {templatePath && (
                          <p className="section-help" style={{ marginTop: 6, fontWeight: 700 }}>
                            {templatePath}
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn-soft"
                          style={{ marginTop: '8px' }}
                          onClick={handlePickTemplateFile}
                        >
                          개찰결과파일 변경
                        </button>
                        <button
                          type="button"
                          className="btn-soft"
                          style={{ marginTop: '8px' }}
                          onClick={handleClearTemplateFile}
                          disabled={!templatePath}
                        >
                          업로드 파일 지우기
                        </button>
                      </div>
                      <div>
                        <label className="field-label" style={strongLabelStyle}>발주처결과 업로드</label>
                        <input
                          type="file"
                          className="input"
                          accept=".xlsx,.xls"
                          ref={orderingFileInputRef}
                          onChange={handleOrderingResultUpload}
                          onClick={(e) => { e.target.value = ''; }}
                          disabled={!ownerId}
                        />
                        {!ownerId && (
                          <p className="section-help" style={{ marginTop: 8 }}>
                            위 협정 업체 체크 섹션에서 발주처를 먼저 선택해 주세요.
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn-soft"
                          style={{ marginTop: '8px' }}
                          onClick={handleClearOrderingFile}
                          disabled={!orderingResultFile}
                        >
                          업로드 파일 지우기
                        </button>
                        {orderingResultFile && (
                          <p className="section-help" style={{ marginTop: 8 }}>
                            선택된 파일: {orderingResultFile.name}
                          </p>
                        )}
                      </div>
                      <div className="excel-helper-actions">
                        <button
                          type="button"
                          className="primary"
                          onClick={handleRunOrderingProcess}
                          disabled={isOrderingProcessing || !ownerId}
                          style={{ minWidth: '180px' }}
                        >
                          {isOrderingProcessing ? '처리 중...' : '결과 실행'}
                        </button>
                      </div>
                    </div>
                  </div>
                  </>
              </section>
            </div>
          </div>
        </div>
      </div>
      {companyConflictModal.open && (
        <div className="excel-helper-modal-overlay" role="presentation">
          <div className="excel-helper-modal" role="dialog" aria-modal="true">
            <header className="excel-helper-modal__header">
              <h3>중복된 업체 선택</h3>
              <p>동일한 이름의 업체가 여러 건 조회되었습니다. 각 업체에 맞는 자료를 선택해 주세요.</p>
            </header>
            <div className="excel-helper-modal__body">
              {(companyConflictModal.entries || []).map((entry) => (
                <div key={entry.normalizedName} className="excel-helper-modal__conflict">
                  <div className="excel-helper-modal__conflict-title">{entry.displayName}</div>
                  <div className="excel-helper-modal__options">
                    {entry.options.map((option) => {
                      const optionKey = buildCompanyOptionKey(option);
                      const selectedKey = companyConflictSelections?.[entry.normalizedName];
                      const isActive = selectedKey === optionKey;
                      const bizNo = pickFirstValue(option, BIZ_FIELDS) || '-';
                      const representative = pickFirstValue(option, REPRESENTATIVE_FIELDS) || '-';
                      const region = pickFirstValue(option, REGION_FIELDS) || '-';
                      const typeKey = String(option?._file_type || '').toLowerCase();
                      const typeLabel = FILE_TYPE_LABELS[typeKey] || '';
                      const managers = extractManagerNames(option);
                      return (
                        <button
                          key={optionKey}
                          type="button"
                          className={isActive ? 'excel-helper-modal__option active' : 'excel-helper-modal__option'}
                          onClick={() => handleCompanyConflictPick(entry.normalizedName, option)}
                        >
                          <div className="excel-helper-modal__option-name">
                            {pickFirstValue(option, NAME_FIELDS) || entry.displayName}
                            {typeLabel && <span className={`file-type-badge-small file-type-${typeKey}`}>{typeLabel}</span>}
                          </div>
                          <div className="excel-helper-modal__option-meta">사업자번호 {bizNo}</div>
                          <div className="excel-helper-modal__option-meta">대표자 {representative} · 지역 {region}</div>
                          {managers.length > 0 && (
                            <div className="excel-helper-modal__option-managers">
                              {managers.map((manager) => (
                                <span key={`${optionKey}-${manager}`} className="badge-person">{manager}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <footer className="excel-helper-modal__footer">
              <button type="button" className="btn-soft" onClick={handleCompanyConflictCancel} disabled={companyConflictModal.isResolving}>취소</button>
              <button
                type="button"
                className="primary"
                onClick={handleCompanyConflictConfirm}
                disabled={companyConflictModal.isResolving}
              >
                {companyConflictModal.isResolving ? '처리 중...' : '선택 완료'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
