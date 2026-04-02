const path = require('path');
const { ROOTS, ensureDir, readJsonFile, writeJsonFile } = require('./local-storage');

const TEMP_COMPANIES_DOCUMENT_PATH = path.join(ROOTS.tempCompanies, 'index.json');
const INDUSTRIES = new Set(['eung', 'tongsin', 'sobang']);

const normalizeIndustry = (value) => {
  const token = String(value || '').trim().toLowerCase();
  if (token === '전기' || token === 'eung') return 'eung';
  if (token === '통신' || token === 'tongsin') return 'tongsin';
  if (token === '소방' || token === 'sobang') return 'sobang';
  return '';
};

const normalizeString = (value) => String(value || '').trim();
const normalizeDigits = (value) => String(value || '').replace(/\D/g, '');

function createInitialDocument() {
  return {
    version: 1,
    nextId: 1,
    updatedAt: null,
    companies: [],
  };
}

function normalizeCompany(input = {}, fallbackId = 0) {
  const idNumber = Number(input.id);
  const id = Number.isInteger(idNumber) && idNumber > 0 ? idNumber : fallbackId;
  return {
    id,
    name: normalizeString(input.name),
    industry: normalizeIndustry(input.industry),
    managerName: normalizeString(input.managerName),
    representative: normalizeString(input.representative),
    bizNo: normalizeDigits(input.bizNo),
    region: normalizeString(input.region),
    sipyung: normalizeString(input.sipyung),
    performance3y: normalizeString(input.performance3y),
    performance5y: normalizeString(input.performance5y),
    debtRatio: normalizeString(input.debtRatio),
    currentRatio: normalizeString(input.currentRatio),
    bizYears: normalizeString(input.bizYears),
    creditGrade: normalizeString(input.creditGrade),
    womenOwned: normalizeString(input.womenOwned),
    smallBusiness: normalizeString(input.smallBusiness),
    jobCreation: normalizeString(input.jobCreation),
    qualityEval: normalizeString(input.qualityEval),
    notes: normalizeString(input.notes),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizeDocument(input) {
  const base = createInitialDocument();
  const source = input && typeof input === 'object' ? input : {};
  const companies = Array.isArray(source.companies) ? source.companies : [];
  const normalizedCompanies = [];
  let nextId = Number.isInteger(source.nextId) && source.nextId > 0 ? source.nextId : 1;

  companies.forEach((item) => {
    const normalized = normalizeCompany(item, nextId);
    if (!normalized.id) {
      normalized.id = nextId;
      nextId += 1;
    } else {
      nextId = Math.max(nextId, normalized.id + 1);
    }
    normalizedCompanies.push(normalized);
  });

  return {
    version: 1,
    nextId,
    updatedAt: source.updatedAt || null,
    companies: normalizedCompanies,
  };
}

async function readTempCompaniesDocument() {
  await ensureDir(ROOTS.tempCompanies);
  const raw = await readJsonFile(TEMP_COMPANIES_DOCUMENT_PATH, null);
  return normalizeDocument(raw);
}

async function writeTempCompaniesDocument(document) {
  const normalized = normalizeDocument(document);
  normalized.updatedAt = new Date().toISOString();
  await ensureDir(ROOTS.tempCompanies);
  await writeJsonFile(TEMP_COMPANIES_DOCUMENT_PATH, normalized);
  return normalized;
}

function matchesQuery(company, query = '') {
  const keyword = normalizeString(query).toLowerCase();
  if (!keyword) return true;
  return [
    company.name,
    company.representative,
    company.bizNo,
    company.managerName,
    company.region,
    company.notes,
  ].some((value) => String(value || '').toLowerCase().includes(keyword));
}

function listCompaniesFromDocument(document, filters = {}) {
  const query = normalizeString(filters.query);
  const industry = normalizeIndustry(filters.industry);
  const list = (document?.companies || []).filter((item) => {
    if (industry && item.industry !== industry) return false;
    if (!matchesQuery(item, query)) return false;
    return true;
  });
  list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return list;
}

function extractCreditGradeToken(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  const cleaned = source.replace(/\s+/g, ' ').toUpperCase();
  const match = cleaned.match(/^([A-Z]{1,3}[0-9]?(?:[+-])?)/);
  if (match && match[1]) return match[1];
  const token = cleaned.split(/[\s(]/)[0] || '';
  return token.replace(/[^A-Z0-9+-]/g, '') || '';
}

function toSearchCompany(company = {}) {
  const industry = normalizeIndustry(company.industry);
  const notes = [normalizeString(company.managerName), normalizeString(company.notes)].filter(Boolean).join(' | ');
  return {
    '검색된 회사': normalizeString(company.name),
    대표자: normalizeString(company.representative),
    사업자번호: normalizeDigits(company.bizNo),
    대표지역: normalizeString(company.region),
    지역: normalizeString(company.region),
    시평: normalizeString(company.sipyung),
    '3년 실적': normalizeString(company.performance3y),
    '5년 실적': normalizeString(company.performance5y),
    부채비율: normalizeString(company.debtRatio),
    유동비율: normalizeString(company.currentRatio),
    영업기간: normalizeString(company.bizYears),
    신용평가: normalizeString(company.creditGrade),
    여성기업: normalizeString(company.womenOwned),
    중소기업: normalizeString(company.smallBusiness),
    일자리창출: normalizeString(company.jobCreation),
    품질평가: normalizeString(company.qualityEval),
    비고: notes,
    담당자명: normalizeString(company.managerName),
    데이터상태: {},
    요약상태: '임시',
    _file_type: industry || 'temp',
    _creditGrade: extractCreditGradeToken(company.creditGrade),
    _is_temp_company: true,
    _temp_company_id: company.id,
  };
}

async function listTempCompanySearchRows(fileType = 'all') {
  const normalizedType = String(fileType || 'all').trim().toLowerCase();
  const doc = await readTempCompaniesDocument();
  const companies = doc.companies || [];
  return companies
    .filter((item) => {
      if (normalizedType === 'all') return true;
      if (!INDUSTRIES.has(normalizedType)) return false;
      return normalizeIndustry(item.industry) === normalizedType;
    })
    .map(toSearchCompany)
    .filter((item) => Boolean(item['검색된 회사']));
}

module.exports = {
  TEMP_COMPANIES_DOCUMENT_PATH,
  normalizeIndustry,
  createInitialDocument,
  readTempCompaniesDocument,
  writeTempCompaniesDocument,
  listCompaniesFromDocument,
  toSearchCompany,
  listTempCompanySearchRows,
};

