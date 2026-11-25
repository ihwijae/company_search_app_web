const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { pathToFileURL } = require('url');
const { ROOTS, ensureDir, readJsonFile } = require('./local-storage');

const SETTINGS_PATH = path.join(ROOTS.config, 'major-materials.json');
let sharedPromise;
let writeQueue = Promise.resolve();
const loadShared = () => {
  if (!sharedPromise) sharedPromise = import(pathToFileURL(path.join(__dirname, '../../src/shared/majorMaterials.js')).href);
  return sharedPromise;
};

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

async function loadMajorMaterials() {
  const { createMajorMaterials, normalizeMajorMaterialItems } = await loadShared();
  const saved = await readJsonFile(SETTINGS_PATH);
  if (saved === null) return createMajorMaterials();
  if (!saved || saved.version !== 1 || !Number.isInteger(saved.revision) || saved.revision < 1 || typeof saved.updatedAt !== 'string') fail('저장된 주요자재 설정 형식이 올바르지 않습니다.', 500);
  return { version: 1, revision: saved.revision, updatedAt: saved.updatedAt, items: normalizeMajorMaterialItems(saved.items) };
}

function saveMajorMaterials(payload) {
  const task = writeQueue.then(async () => {
    const { normalizeMajorMaterialItems } = await loadShared();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Number.isInteger(payload.revision) || payload.revision < 0) fail('주요자재 저장 요청 형식이 올바르지 않습니다.', 400);
    let items;
    try {
      items = normalizeMajorMaterialItems(payload.items);
    } catch (error) {
      error.status = 400;
      throw error;
    }
    const current = await loadMajorMaterials();
    if (payload.revision !== current.revision) fail('다른 화면에서 주요자재 정보를 변경했습니다. 최신 정보를 다시 불러온 후 수정해 주세요.', 409);
    const document = { version: 1, revision: current.revision + 1, updatedAt: new Date().toISOString(), items };
    await ensureDir(ROOTS.config);
    const temporary = `${SETTINGS_PATH}.${randomUUID()}.tmp`;
    try {
      await fs.promises.writeFile(temporary, JSON.stringify(document, null, 2), 'utf8');
      await fs.promises.rename(temporary, SETTINGS_PATH);
    } finally {
      await fs.promises.unlink(temporary).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    }
    return document;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

module.exports = { loadMajorMaterials, saveMajorMaterials };
