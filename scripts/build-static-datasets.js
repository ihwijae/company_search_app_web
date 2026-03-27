const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_DIR = path.join(ROOT_DIR, 'db');
const OUTPUT_DIR = path.join(ROOT_DIR, 'public', 'datasets');

const DATASET_RULES = [
  { type: 'eung', matcher: /전기/ },
  { type: 'tongsin', matcher: /통신/ },
  { type: 'sobang', matcher: /소방/ },
];

const RELATIVE_OFFSETS = {
  대표자: 1,
  사업자번호: 2,
  지역: 3,
  시평: 4,
  '3년 실적': 5,
  '5년 실적': 6,
  부채비율: 7,
  유동비율: 8,
  영업기간: 9,
  신용평가: 10,
  여성기업: 11,
  중소기업: 12,
  일자리창출: 13,
  품질평가: 14,
  비고: 15,
};

const normalizeCellText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => (part?.text ? String(part.text) : '')).join('').trim();
    }
    if (value.text !== undefined && value.text !== null) return String(value.text).trim();
    if (value.result !== undefined && value.result !== null) return String(value.result).trim();
    if (value.hyperlink !== undefined && value.hyperlink !== null) return String(value.hyperlink).trim();
  }
  return String(value).trim();
};

const getStatusFromColor = (cell) => {
  if (!cell?.style?.fill) return '1년 이상 경과';
  const fgColor = cell.style.fill.fgColor;
  if (!fgColor || fgColor.theme === undefined) return '1년 이상 경과';
  switch (fgColor.theme) {
    case 6:
      return '최신';
    case 3:
      return '1년 경과';
    case 0:
    case 1:
      return '1년 이상 경과';
    default:
      return '미지정';
  }
};

const getSummaryStatus = (statusesDict) => {
  const keyStatuses = [
    statusesDict['시평'] || '미지정',
    statusesDict['3년 실적'] || '미지정',
    statusesDict['5년 실적'] || '미지정',
  ];
  if (keyStatuses.includes('1년 이상 경과')) return '1년 이상 경과';
  if (keyStatuses.includes('1년 경과')) return '1년 경과';
  if (keyStatuses.every((status) => status === '최신')) return '최신';
  return '미지정';
};

const extractManagerName = (notes) => {
  if (!notes) return null;
  const text = String(notes).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const firstToken = text.split(/[ ,/|·-]+/).filter(Boolean)[0] || '';
  const cleanedFirst = firstToken.replace(/^[\[\(（【]([^\]\)）】]+)[\]\)】]?$/, '$1');
  if (/^[가-힣]{2,4}$/.test(cleanedFirst)) return cleanedFirst;
  let match = text.match(/담당자?\s*[:：-]?\s*([가-힣]{2,4})/);
  if (match?.[1]) return match[1];
  match = text.match(/([가-힣]{2,4})\s*(과장|팀장|차장|대리|사원|부장|대표|실장|소장)/);
  if (match?.[1]) return match[1];
  match = text.match(/\b(?!확인서|등록증|증명서|평가|서류)([가-힣]{2,4})\b\s*(?:,|\/|\(|\d|$)/);
  return match?.[1] || null;
};

const extractCreditGradeToken = (value) => {
  if (value === null || value === undefined) return '';
  const source = String(value).trim();
  if (!source) return '';
  const cleaned = source.replace(/\s+/g, ' ').toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/);
  if (match?.[1]) return match[1];
  const token = cleaned.split(/[\s(]/)[0] || '';
  return token.replace(/[^A-Z0-9+-]/g, '') || '';
};

const buildDatasetMeta = (filePath, type) => {
  const stat = fs.statSync(filePath);
  const fileName = path.basename(filePath);
  return {
    filePath,
    fileName,
    type,
    updatedAt: stat.mtime.toISOString(),
    version: `${fileName}:${Math.trunc(stat.mtimeMs)}`,
  };
};

const extractCompaniesFromWorkbook = async (filePath, type, meta) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const companies = [];
  const sheetNames = [];

  workbook.worksheets.forEach((sheet) => {
    const trimmedSheetName = String(sheet.name || '').trim();
    if (!trimmedSheetName) return;
    sheetNames.push(trimmedSheetName);
    const maxRow = sheet.rowCount || 0;
    const maxCol = sheet.columnCount || 0;

    for (let row = 1; row <= maxRow; row += 1) {
      const firstCellValue = sheet.getCell(row, 1).value;
      if (typeof firstCellValue !== 'string' || !firstCellValue.trim().includes('회사명')) continue;

      for (let col = 2; col <= maxCol; col += 1) {
        const rawCompanyName = sheet.getCell(row, col).value;
        if (typeof rawCompanyName !== 'string' || !rawCompanyName.trim()) continue;
        const companyName = String(rawCompanyName).split('\n')[0].replace(/\s*[\d.,%].*$/, '').trim();
        if (!companyName) continue;

        const companyData = {
          '검색된 회사': companyName,
          대표지역: trimmedSheetName,
          _file_type: type,
        };
        const companyStatuses = {};
        Object.keys(RELATIVE_OFFSETS).forEach((key) => {
          const targetRow = row + RELATIVE_OFFSETS[key];
          if (targetRow > maxRow) {
            companyData[key] = 'N/A';
            companyStatuses[key] = 'N/A';
            return;
          }
          const valueCell = sheet.getCell(targetRow, col);
          const status = getStatusFromColor(valueCell);
          let processedValue = (key === '부채비율' || key === '유동비율') && typeof valueCell.value === 'number'
            ? valueCell.value * 100
            : valueCell.value;
          if (processedValue && typeof processedValue === 'object') {
            processedValue = normalizeCellText(processedValue);
          }
          companyData[key] = processedValue ?? '';
          companyStatuses[key] = status;
        });
        companyData['데이터상태'] = companyStatuses;
        companyData['요약상태'] = getSummaryStatus(companyStatuses);
        const manager = extractManagerName(companyData['비고']);
        if (manager) companyData['담당자명'] = manager;
        const normalizedCreditGrade = extractCreditGradeToken(companyData['신용평가']);
        if (normalizedCreditGrade) companyData._creditGrade = normalizedCreditGrade;
        companies.push(companyData);
      }
    }
  });

  return {
    type,
    fileName: meta.fileName,
    updatedAt: meta.updatedAt,
    version: meta.version,
    sheetNames,
    companies,
  };
};

const extractCompaniesWithXlsxFallback = (filePath, type, meta) => {
  const workbook = XLSX.readFile(filePath, {
    cellStyles: true,
    cellFormula: false,
    cellHTML: false,
    cellText: true,
  });

  const companies = [];
  const sheetNames = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const trimmedSheetName = String(sheetName || '').trim();
    if (!trimmedSheetName) return;
    sheetNames.push(trimmedSheetName);
    const ref = sheet['!ref'];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const headerCell = sheet[XLSX.utils.encode_cell({ r: row, c: 0 })];
      const headerValue = normalizeCellText(headerCell?.v ?? headerCell?.w ?? '');
      if (!headerValue.includes('회사명')) continue;

      for (let col = 1; col <= range.e.c; col += 1) {
        const companyCell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
        const rawCompanyName = normalizeCellText(companyCell?.v ?? companyCell?.w ?? '');
        if (!rawCompanyName) continue;
        const companyName = rawCompanyName.split('\n')[0].replace(/\s*[\d.,%].*$/, '').trim();
        if (!companyName) continue;

        const companyData = {
          '검색된 회사': companyName,
          대표지역: trimmedSheetName,
          _file_type: type,
        };
        const companyStatuses = {};
        Object.keys(RELATIVE_OFFSETS).forEach((key) => {
          const targetRow = row + RELATIVE_OFFSETS[key];
          if (targetRow > range.e.r) {
            companyData[key] = 'N/A';
            companyStatuses[key] = 'N/A';
            return;
          }
          const cell = sheet[XLSX.utils.encode_cell({ r: targetRow, c: col })];
          let processedValue = cell?.v ?? cell?.w ?? '';
          if ((key === '부채비율' || key === '유동비율') && typeof processedValue === 'number') {
            processedValue *= 100;
          }
          if (processedValue && typeof processedValue === 'object') {
            processedValue = normalizeCellText(processedValue);
          }
          companyData[key] = processedValue ?? '';
          companyStatuses[key] = '미지정';
        });
        companyData['데이터상태'] = companyStatuses;
        companyData['요약상태'] = getSummaryStatus(companyStatuses);
        const manager = extractManagerName(companyData['비고']);
        if (manager) companyData['담당자명'] = manager;
        const normalizedCreditGrade = extractCreditGradeToken(companyData['신용평가']);
        if (normalizedCreditGrade) companyData._creditGrade = normalizedCreditGrade;
        companies.push(companyData);
      }
    }
  });

  return {
    type,
    fileName: meta.fileName,
    updatedAt: meta.updatedAt,
    version: meta.version,
    sheetNames,
    companies,
  };
};

const resolveSourceFiles = () => {
  if (!fs.existsSync(DB_DIR)) {
    throw new Error(`db directory not found: ${DB_DIR}`);
  }
  const entries = fs.readdirSync(DB_DIR).filter((name) => /\.xlsx$/i.test(name));
  const resolved = {};
  DATASET_RULES.forEach(({ type, matcher }) => {
    const matched = entries.find((name) => matcher.test(name));
    if (!matched) {
      throw new Error(`${type} source file not found in db/`);
    }
    resolved[type] = path.join(DB_DIR, matched);
  });
  return resolved;
};

async function main() {
  const sourceFiles = resolveSourceFiles();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    datasets: {},
  };

  for (const { type } of DATASET_RULES) {
    const filePath = sourceFiles[type];
    const meta = buildDatasetMeta(filePath, type);
    let dataset;
    try {
      dataset = await extractCompaniesFromWorkbook(filePath, type, meta);
    } catch (error) {
      console.warn(`[build-static-datasets] exceljs parse failed for ${meta.fileName}, fallback to xlsx:`, error.message || error);
      dataset = extractCompaniesWithXlsxFallback(filePath, type, meta);
    }
    fs.writeFileSync(path.join(OUTPUT_DIR, `${type}.json`), JSON.stringify(dataset, null, 2), 'utf8');
    manifest.datasets[type] = {
      fileName: meta.fileName,
      updatedAt: meta.updatedAt,
      version: meta.version,
      count: Array.isArray(dataset.companies) ? dataset.companies.length : 0,
    };
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('[build-static-datasets] datasets generated:', Object.keys(manifest.datasets).join(', '));
}

main().catch((error) => {
  console.error('[build-static-datasets] failed:', error);
  process.exit(1);
});
