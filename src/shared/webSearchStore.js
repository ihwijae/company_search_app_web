import ExcelJS from 'exceljs';
import CREDIT_GRADE_ORDER from './creditGrades.json';

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

const DB_NAME = 'company-search-web';
const STORE_NAME = 'search-datasets';
const DATASET_TYPES = ['eung', 'tongsin', 'sobang'];

const datasets = new Map();
const listeners = new Set();
let loadPromise = null;

const CREDIT_GRADE_RANK = Array.isArray(CREDIT_GRADE_ORDER)
  ? CREDIT_GRADE_ORDER
    .map((grade) => String(grade || '').trim().toUpperCase())
    .reduce((map, grade, index) => {
      if (grade) map.set(grade, index);
      return map;
    }, new Map())
  : new Map();

const notifyListeners = (payload) => {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.error('[webSearchStore] listener failed:', error);
    }
  });
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const openDb = async () => {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'type' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
};

const withStore = async (mode, callback) => {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('IndexedDB transaction failed'));
    };
    Promise.resolve(callback(store))
      .then((value) => {
        result = value;
      })
      .catch((error) => {
        db.close();
        reject(error);
      });
  });
};

const loadPersisted = async () => {
  if (loadPromise) return loadPromise;
  loadPromise = withStore('readonly', (store) => new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error || new Error('Failed to load datasets'));
    request.onsuccess = () => resolve(request.result || []);
  }))
    .then((rows) => {
      (rows || []).forEach((row) => {
        if (!row?.type) return;
        datasets.set(row.type, row);
      });
    })
    .catch((error) => {
      console.warn('[webSearchStore] persisted dataset load failed:', error);
    });
  return loadPromise;
};

const persistDataset = async (dataset) => {
  await withStore('readwrite', (store) => new Promise((resolve, reject) => {
    const request = store.put(dataset);
    request.onerror = () => reject(request.error || new Error('Failed to persist dataset'));
    request.onsuccess = () => resolve(request.result);
  }));
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

const normalizeBizNumber = (value) => String(value ?? '').replace(/[^0-9]/g, '').trim();

const parseAmount = (value) => {
  if (value === null || value === undefined) return 0;
  const textValue = String(value).trim();
  if (!textValue) return 0;
  try {
    const cleaned = textValue.replace(/[,\s]/g, '').replace(/(억원|억|만원|만|원)$/g, '');
    const normalized = cleaned.replace(/[^0-9.+-]/g, '');
    if (!normalized) return 0;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  } catch {
    return 0;
  }
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

const getCreditGradeRank = (gradeToken) => {
  if (!gradeToken) return Number.POSITIVE_INFINITY;
  const normalized = String(gradeToken).trim().toUpperCase();
  if (!normalized) return Number.POSITIVE_INFINITY;
  return CREDIT_GRADE_RANK.has(normalized)
    ? CREDIT_GRADE_RANK.get(normalized)
    : Number.POSITIVE_INFINITY;
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

const isWomenOwned = (company) => {
  const raw = company?.['여성기업'];
  if (raw === null || raw === undefined) return false;
  const text = String(raw).trim();
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  return normalized && normalized !== '없음' && normalized !== '-' && normalized !== '무';
};

const hasQualityEvaluation = (company) => {
  const raw = company?.['품질평가'];
  if (raw === null || raw === undefined) return false;
  const text = String(raw).trim();
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  if (!normalized || normalized.includes('없음') || normalized === '-' || normalized === '무') return false;
  return /\d/.test(normalized);
};

const buildDedupKey = (item) => {
  if (!item || typeof item !== 'object') return '';
  const typeToken = item._file_type ? String(item._file_type).trim().toLowerCase() : '';
  const regionSource = item['대표지역'] || item['지역'];
  const regionToken = regionSource ? String(regionSource).trim() : '';
  const appendRegion = (baseKey) => (regionToken ? `${baseKey}|region:${regionToken}` : baseKey);
  const biz = normalizeBizNumber(item['사업자번호']);
  if (biz) {
    const baseKey = typeToken ? `biz:${biz}|type:${typeToken}` : `biz:${biz}`;
    return appendRegion(baseKey);
  }
  const nameSource = item['검색된 회사'] || item['회사명'] || item['대표자'];
  if (nameSource) {
    const normalized = String(nameSource).trim();
    if (normalized) {
      const baseKey = typeToken ? `name:${normalized}|type:${typeToken}` : `name:${normalized}`;
      return appendRegion(baseKey);
    }
  }
  return '';
};

const dedupeCompanies = (list) => {
  const seen = new Set();
  const deduped = [];
  let fallbackIndex = 0;
  (list || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    let key = buildDedupKey(item);
    if (!key) key = `row:${fallbackIndex++}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });
  return deduped;
};

const postProcessResults = (inputResults, options = {}) => {
  const base = Array.isArray(inputResults) ? [...inputResults] : [];
  const {
    onlyLatest = false,
    onlyWomenOwned = false,
    onlyLHQuality = false,
    sortKey = null,
    sortDir = 'desc',
    pagination = null,
  } = options || {};

  let working = [...base];
  if (onlyLatest) working = working.filter((item) => (item?.['요약상태'] || '') === '최신');
  if (onlyWomenOwned) working = working.filter((item) => isWomenOwned(item));
  if (onlyLHQuality) working = working.filter((item) => hasQualityEvaluation(item));

  const sortField = ({ sipyung: '시평', '3y': '3년 실적', '5y': '5년 실적' })[sortKey] || null;
  if (sortField) {
    const direction = sortDir === 'asc' ? 1 : -1;
    const collator = new Intl.Collator('ko', { sensitivity: 'base' });
    const hasMetric = (value) => {
      if (value === null || value === undefined) return false;
      const str = String(value).trim();
      return Boolean(str && str !== '-' && str !== 'N/A' && str !== 'NA');
    };
    working = [...working].sort((a, b) => {
      const rawA = a?.[sortField];
      const rawB = b?.[sortField];
      const aHas = hasMetric(rawA);
      const bHas = hasMetric(rawB);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      const av = aHas ? parseAmount(rawA) : 0;
      const bv = bHas ? parseAmount(rawB) : 0;
      if (av === bv) {
        const nameCompare = collator.compare(String(a?.['검색된 회사'] || ''), String(b?.['검색된 회사'] || ''));
        if (nameCompare !== 0) return nameCompare;
        return collator.compare(String(a?.['사업자번호'] || ''), String(b?.['사업자번호'] || ''));
      }
      return av > bv ? direction : -direction;
    });
  }

  working = dedupeCompanies(working);
  const totalCount = working.length;
  if (pagination && Number.isFinite(Number.parseInt(pagination.pageSize, 10)) && Number(pagination.pageSize) > 0) {
    const pageSize = Number.parseInt(pagination.pageSize, 10);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(Math.max(Number.parseInt(pagination.page, 10) || 1, 1), totalPages);
    const start = (page - 1) * pageSize;
    return {
      items: working.slice(start, start + pageSize),
      meta: { totalCount, totalPages, page, pageSize },
    };
  }
  return { items: working, meta: { totalCount } };
};

const searchCompaniesInDataset = (companies, criteria = {}, options = {}) => {
  let results = Array.isArray(companies) ? [...companies] : [];
  const normalizeRegion = (value) => String(value || '').trim();
  const includeRegions = Array.isArray(criteria.includeRegions)
    ? criteria.includeRegions.map(normalizeRegion).filter((region) => region && region !== '전체')
    : [];
  const excludeRegions = Array.isArray(criteria.excludeRegions)
    ? criteria.excludeRegions.map(normalizeRegion).filter((region) => region && region !== '전체')
    : [];

  if (includeRegions.length > 0) {
    const includeSet = new Set(includeRegions);
    results = results.filter((company) => includeSet.has(normalizeRegion(company['대표지역'])));
  } else if (criteria.region && criteria.region !== '전체') {
    const target = normalizeRegion(criteria.region);
    results = results.filter((company) => normalizeRegion(company['대표지역']) === target);
  }

  if (excludeRegions.length > 0) {
    const excludeSet = new Set(excludeRegions);
    results = results.filter((company) => !excludeSet.has(normalizeRegion(company['대표지역'])));
  }

  if (criteria.name) {
    const searchName = String(criteria.name).toLowerCase();
    results = results.filter((company) => String(company['검색된 회사'] || '').toLowerCase().includes(searchName));
  }

  if (criteria.manager) {
    const searchManager = String(criteria.manager).toLowerCase();
    results = results.filter((company) => String(company['비고'] || '').toLowerCase().includes(searchManager));
  }

  if (criteria.bizNumber) {
    const searchBiz = normalizeBizNumber(criteria.bizNumber);
    if (searchBiz) {
      results = results.filter((company) => normalizeBizNumber(company['사업자번호']).includes(searchBiz));
    }
  }

  const minCreditGrade = extractCreditGradeToken(criteria.min_credit_grade || criteria.minCreditGrade || '');
  const minCreditRank = getCreditGradeRank(minCreditGrade);
  if (minCreditGrade && Number.isFinite(minCreditRank)) {
    results = results.filter((company) => {
      const effectiveRank = Number.isFinite(company?._creditGradeRank)
        ? company._creditGradeRank
        : getCreditGradeRank(extractCreditGradeToken(company?.신용평가));
      return Number.isFinite(effectiveRank) && effectiveRank <= minCreditRank;
    });
  }

  const rangeFilters = { sipyung: '시평', '3y': '3년 실적', '5y': '5년 실적' };
  Object.keys(rangeFilters).forEach((key) => {
    const minVal = parseAmount(criteria[`min_${key}`]);
    const maxVal = parseAmount(criteria[`max_${key}`]);
    const fieldName = rangeFilters[key];
    if (minVal) {
      results = results.filter((company) => parseAmount(company[fieldName]) >= minVal);
    }
    if (maxVal) {
      results = results.filter((company) => parseAmount(company[fieldName]) <= maxVal);
    }
  });

  return postProcessResults(results, options || {});
};

const extractCompaniesFromWorkbook = async (arrayBuffer, fileType, fileName) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const companies = [];
  const sheetNames = [];

  workbook.worksheets.forEach((sheet) => {
    const trimmedSheetName = String(sheet.name || '').trim();
    if (!trimmedSheetName) return;
    sheetNames.push(trimmedSheetName);

    const maxRow = sheet.rowCount || 0;
    const maxCol = sheet.columnCount || 0;

    for (let rIdx = 1; rIdx <= maxRow; rIdx += 1) {
      const firstCellValue = sheet.getCell(rIdx, 1).value;
      if (typeof firstCellValue !== 'string' || !firstCellValue.trim().includes('회사명')) continue;

      for (let cIdx = 2; cIdx <= maxCol; cIdx += 1) {
        const rawCompanyName = sheet.getCell(rIdx, cIdx).value;
        if (typeof rawCompanyName !== 'string' || !rawCompanyName.trim()) continue;

        const companyName = String(rawCompanyName).split('\n')[0].replace(/\s*[\d.,%].*$/, '').trim();
        if (!companyName) continue;

        const companyData = {
          '검색된 회사': companyName,
          대표지역: trimmedSheetName,
          _file_type: fileType,
        };
        const companyStatuses = {};

        Object.keys(RELATIVE_OFFSETS).forEach((item) => {
          const targetRow = rIdx + RELATIVE_OFFSETS[item];
          if (targetRow > maxRow) {
            companyData[item] = 'N/A';
            companyStatuses[item] = 'N/A';
            return;
          }
          const valueCell = sheet.getCell(targetRow, cIdx);
          const status = getStatusFromColor(valueCell);
          let processedValue = (item === '부채비율' || item === '유동비율') && typeof valueCell.value === 'number'
            ? valueCell.value * 100
            : valueCell.value;
          if (processedValue && typeof processedValue === 'object') {
            processedValue = normalizeCellText(processedValue);
          }
          companyData[item] = processedValue ?? '';
          companyStatuses[item] = status;
        });

        companyData['데이터상태'] = companyStatuses;
        companyData['요약상태'] = getSummaryStatus(companyStatuses);
        const manager = extractManagerName(companyData['비고']);
        if (manager) companyData['담당자명'] = manager;
        const normalizedCreditGrade = extractCreditGradeToken(companyData['신용평가']);
        if (normalizedCreditGrade) companyData._creditGrade = normalizedCreditGrade;
        companyData._creditGradeRank = getCreditGradeRank(normalizedCreditGrade);
        companies.push(companyData);
      }
    }
  });

  return {
    type: fileType,
    fileName: fileName || '',
    updatedAt: new Date().toISOString(),
    sheetNames,
    companies,
  };
};

export const webSearchStore = {
  async ensureLoaded() {
    await loadPersisted();
  },

  isAvailable() {
    return typeof window !== 'undefined';
  },

  onDataUpdated(callback) {
    if (typeof callback !== 'function') return () => {};
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  async uploadFile(fileType, file) {
    if (!DATASET_TYPES.includes(fileType)) {
      throw new Error('지원하지 않는 파일 유형입니다.');
    }
    if (!(file instanceof File)) {
      throw new Error('업로드할 파일이 없습니다.');
    }
    await this.ensureLoaded();
    const buffer = await file.arrayBuffer();
    const dataset = await extractCompaniesFromWorkbook(buffer, fileType, file.name);
    datasets.set(fileType, dataset);
    try {
      await persistDataset(dataset);
    } catch (error) {
      console.warn('[webSearchStore] dataset persistence failed:', error);
    }
    notifyListeners({ type: fileType, source: 'web-upload' });
    return {
      success: true,
      path: file.name,
      data: {
        type: fileType,
        fileName: file.name,
        count: dataset.companies.length,
      },
    };
  },

  async checkFiles() {
    await this.ensureLoaded();
    return DATASET_TYPES.reduce((acc, type) => {
      acc[type] = Array.isArray(datasets.get(type)?.companies) && datasets.get(type).companies.length > 0;
      return acc;
    }, {});
  },

  async getRegions(fileType) {
    await this.ensureLoaded();
    if (fileType === 'all') {
      const set = new Set(['전체']);
      DATASET_TYPES.forEach((type) => {
        (datasets.get(type)?.sheetNames || []).forEach((name) => set.add(name));
      });
      return { success: true, data: Array.from(set) };
    }
    const dataset = datasets.get(fileType);
    return { success: true, data: dataset ? ['전체', ...(dataset.sheetNames || [])] : ['전체'] };
  },

  async searchCompanies(criteria, fileType, options) {
    await this.ensureLoaded();
    const normalizedCriteria = parseMaybeJson(criteria) || {};
    const normalizedOptions = parseMaybeJson(options) || {};

    if (fileType === 'all') {
      const merged = [];
      DATASET_TYPES.forEach((type) => {
        const dataset = datasets.get(type);
        if (!dataset?.companies?.length) return;
        dataset.companies.forEach((item) => merged.push({ ...item, _file_type: type }));
      });
      const processed = postProcessResults(merged, normalizedOptions || {});
      return { success: true, data: processed.items, meta: processed.meta };
    }

    const dataset = datasets.get(fileType);
    if (!dataset?.companies?.length) {
      return { success: false, message: `${fileType} 파일이 로드되지 않았습니다` };
    }

    const processed = searchCompaniesInDataset(dataset.companies, normalizedCriteria, normalizedOptions || {});
    return { success: true, data: processed.items, meta: processed.meta };
  },
};

export default webSearchStore;
