const path = require('path');
const { pathToFileURL } = require('url');
const { ROOTS, readJsonFile, writeJsonFile } = require('./local-storage');

const DOCUMENT_PATH = path.join(ROOTS.config, 'fixed-companies.json');
let sharedModulePromise;
let writeQueue = Promise.resolve();
const loadSharedModule = () => {
  if (!sharedModulePromise) {
    sharedModulePromise = import(pathToFileURL(path.join(__dirname, '../../src/shared/fixedCompanies.js')).href);
  }
  return sharedModulePromise;
};

async function loadFixedCompanies() {
  const doc = await readJsonFile(DOCUMENT_PATH, { version: 1, groups: {} });
  if (!doc || doc.version !== 1 || !doc.groups || typeof doc.groups !== 'object' || Array.isArray(doc.groups)) {
    throw new Error('고정업체 설정 파일의 형식이 올바르지 않습니다.');
  }
  return doc;
}

function saveFixedCompanyGroup(payload = {}) {
  const task = writeQueue.then(async () => {
    const { normalizeFixedCompanyScope, getFixedCompanyScopeKey, normalizeFixedCompanyList } = await loadSharedModule();
    let scope;
    try {
      scope = normalizeFixedCompanyScope(payload.scope);
      if (!Array.isArray(payload.companies)) throw new Error('업체 목록이 올바르지 않습니다.');
    } catch (error) {
      error.status = 400;
      throw error;
    }
    const key = getFixedCompanyScopeKey(scope);
    const doc = await loadFixedCompanies();
    const current = doc.groups[key];
    const revision = Number(current?.revision || 0);
    if (Number(payload.revision || 0) !== revision) {
      const error = new Error('다른 화면에서 이 설정을 변경했습니다. 최신 설정을 다시 불러온 뒤 수정해 주세요.');
      error.status = 409;
      throw error;
    }
    const group = {
      ...scope,
      companies: normalizeFixedCompanyList(payload.companies),
      revision: revision + 1,
      updatedAt: new Date().toISOString(),
    };
    const next = { version: 1, groups: { ...doc.groups, [key]: group } };
    await writeJsonFile(DOCUMENT_PATH, next);
    return { key, group };
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

module.exports = { loadFixedCompanies, saveFixedCompanyGroup };
