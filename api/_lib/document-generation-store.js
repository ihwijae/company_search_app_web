const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { pathToFileURL } = require('url');
const formulasDoc = require('../../src/shared/formulas.defaults.json');
const industryAverages = require('../../src/shared/industryAverages.json');
const { evaluateScores } = require('../../src/shared/evaluator');
const { APP_DATA_ROOT, ensureDir, readJsonFile } = require('./local-storage');

const DOCUMENT_ROOT = path.join(APP_DATA_ROOT, 'document-generation');
let writeQueue = Promise.resolve();
const FORM_FIELDS = ['ownerId', 'rangeId', 'estimatedPrice', 'baseAmount', 'bidAmount', 'expectedPrice', 'aValue', 'noticeNo', 'noticeTitle', 'noticeDate', 'writtenDate', 'bidDeadline', 'fontFamily'];
const COMPANY_FIELDS = ['name', 'bizNo', 'representative', 'share', 'rank', 'address', 'phone', 'writer', 'corporateNo', 'creditAgency', 'registrationNo', 'safetyDeductions', 'safetyCertificate', 'performance5y', 'sipyungAmount', 'qualityScore', 'creditGradeText', 'creditExpiry', 'creditExpired', 'creditStatus', 'debtRatio', 'currentRatio', 'bizYears', 'managementMethod'];
let sharedPromise;
const loadShared = () => {
  if (!sharedPromise) sharedPromise = Promise.all([
    import(pathToFileURL(path.join(__dirname, '../../src/shared/agreements/documentEvaluation.js')).href),
    import(pathToFileURL(path.join(__dirname, '../../src/shared/navigation.js')).href),
    import(pathToFileURL(path.join(__dirname, '../../src/shared/agreements/lhApplication.js')).href),
    import(pathToFileURL(path.join(__dirname, '../../src/shared/agreements/lhOverview.js')).href),
  ]);
  return sharedPromise;
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function documentPath(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) fail('서류 ID가 올바르지 않습니다.');
  return path.join(DOCUMENT_ROOT, `${id}.json`);
}

function text(value) {
  if (value === undefined || value === null) return '';
  if (!['string', 'number'].includes(typeof value) || String(value).length > 10000) fail('입력값의 형식이나 길이가 올바르지 않습니다.');
  return String(value);
}

function normalizeForm(form) {
  if (!form || typeof form !== 'object' || Array.isArray(form)) fail('서류 입력정보가 필요합니다.');
  if (!['qualification', 'comprehensive'].includes(form.reviewType)) fail('심사유형이 올바르지 않습니다.');
  if (!['eung', 'tongsin', 'sobang'].includes(form.industry)) fail('공종이 올바르지 않습니다.');
  if (![2, 3, 4, 5].includes(form.companyCount) || !Array.isArray(form.companies) || form.companies.length !== 5) fail('참여업체 정보가 올바르지 않습니다.');
  const fontFamily = text(form.fontFamily) || 'pretendard';
  if (!['pretendard', 'nanum-gothic', 'nanum-myeongjo'].includes(fontFamily)) fail('서류 글꼴이 올바르지 않습니다.');
  return {
    reviewType: form.reviewType, industry: form.industry, companyCount: form.companyCount,
    ...Object.fromEntries(FORM_FIELDS.map((key) => [key, text(form[key])])),
    fontFamily,
    companies: form.companies.map((company) => {
      if (!company || typeof company !== 'object' || Array.isArray(company)) fail('업체정보가 올바르지 않습니다.');
      const managementMethod = text(company.managementMethod) || 'auto';
      if (!['auto', 'composite', 'credit'].includes(managementMethod)) fail('경영상태 평가방법이 올바르지 않습니다.');
      return { ...Object.fromEntries(COMPANY_FIELDS.map((key) => [key, text(company[key])])), managementMethod };
    }),
  };
}

async function loadDocument(id) {
  const document = await readJsonFile(documentPath(id));
  if (!document) fail('저장된 서류를 찾을 수 없습니다.', 404);
  if (document.version !== 1 || document.id !== id || !Number.isInteger(document.revision)) fail('저장된 서류의 형식이 올바르지 않습니다.', 500);
  return { ...document, form: normalizeForm(document.form) };
}

function summarize(document) {
  const { form, evaluationSnapshot, applicationSnapshot, overviewSnapshot, ...metadata } = document;
  return {
    ...metadata, reviewType: form.reviewType, ownerId: form.ownerId, industry: form.industry,
    rangeId: form.rangeId, evaluationStatus: evaluationSnapshot?.result?.status || null,
    applicationReady: applicationSnapshot?.model?.complete || false,
    overviewReady: overviewSnapshot?.model?.calculatedReady || false,
    noticeNo: form.noticeNo, noticeTitle: form.noticeTitle, writtenDate: form.writtenDate,
    companyCount: form.companyCount, companyNames: form.companies.slice(0, form.companyCount).map((company) => company.name).filter(Boolean),
  };
}

async function listDocuments() {
  let files;
  try {
    files = await fs.promises.readdir(DOCUMENT_ROOT);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const documents = await Promise.all(files.filter((file) => file.endsWith('.json')).map(async (file) => {
    try { return await loadDocument(file.slice(0, -5)); }
    catch (error) { if (error.status === 404) return null; throw error; }
  }));
  return documents.filter(Boolean).map(summarize).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function saveDocument(payload = {}) {
  const task = writeQueue.then(async () => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('저장 요청 형식이 올바르지 않습니다.');
    const title = text(payload.title).trim();
    if (!title || title.length > 200) fail('저장 이름은 1~200자로 입력해 주세요.');
    const form = normalizeForm(payload.form);
    const [{ resolveDocumentExperience }, { getDocumentRangeOptions }, { resolveLhApplication }, { resolveLhOverview }] = await loadShared();
    if (form.rangeId && !getDocumentRangeOptions(form.ownerId, form.reviewType).some((range) => range.key === form.rangeId)) fail('발주처와 심사유형에 맞는 금액대를 선택해 주세요.');
    const id = payload.id === undefined || payload.id === null ? randomUUID() : payload.id;
    const target = documentPath(id);
    const current = payload.id === undefined || payload.id === null ? null : await loadDocument(id);
    if (current && payload.revision !== current.revision) fail('다른 화면에서 수정한 서류입니다. 최신 내용을 다시 불러오거나 새 문서로 저장해 주세요.', 409);
    let source = current;
    if (!current && payload.sourceId !== undefined) {
      source = await loadDocument(payload.sourceId);
      if (payload.sourceRevision !== source.revision) fail('원본 서류가 다른 화면에서 변경되었습니다. 다시 불러온 후 사본을 저장해 주세요.', 409);
    }
    const now = new Date().toISOString();
    const evaluationSnapshot = resolveDocumentExperience(form, { previousSnapshot: source?.evaluationSnapshot, formulasDoc, now });
    const applicationSnapshot = resolveLhApplication(form, { previousSnapshot: source?.applicationSnapshot, formulasDoc, industryAverages, evaluateScores, now });
    const overviewSnapshot = resolveLhOverview(form, { previousSnapshot: source?.overviewSnapshot, application: applicationSnapshot, experience: evaluationSnapshot, now });
    const document = { version: 1, id, title, revision: (current?.revision || 0) + 1, createdAt: current?.createdAt || now, updatedAt: now, form, evaluationSnapshot, applicationSnapshot, overviewSnapshot };
    await ensureDir(DOCUMENT_ROOT);
    const temporary = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(temporary, JSON.stringify(document, null, 2), 'utf8');
      await fs.promises.rename(temporary, target);
    } finally {
      await fs.promises.unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
    return document;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

function deleteDocument(payload = {}) {
  const task = writeQueue.then(async () => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('삭제 요청 형식이 올바르지 않습니다.');
    const target = documentPath(payload.id);
    if (!Number.isInteger(payload.revision) || payload.revision < 1) fail('삭제할 서류의 버전 정보가 올바르지 않습니다.');
    const current = await loadDocument(payload.id);
    if (current.revision !== payload.revision) fail('다른 화면에서 수정한 서류입니다. 목록을 새로고침한 후 다시 삭제해 주세요.', 409);
    await fs.promises.unlink(target);
    return { id: current.id };
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

module.exports = { listDocuments, loadDocument, saveDocument, deleteDocument };
