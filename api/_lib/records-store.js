const path = require('path');
const { ROOTS, ensureDir, readJsonFile, writeJsonFile } = require('./local-storage');

const RECORDS_DOCUMENT_PATH = path.join(ROOTS.records, 'index.json');

async function readRecordsDocument() {
  try {
    await ensureDir(ROOTS.records);
    return await readJsonFile(RECORDS_DOCUMENT_PATH, null);
  } catch (error) {
    console.warn('[records-store] read failed:', error && error.message ? error.message : error);
    return null;
  }
}

async function writeRecordsDocument(document) {
  const normalized = document && typeof document === 'object' ? document : {};
  await ensureDir(ROOTS.records);
  await writeJsonFile(RECORDS_DOCUMENT_PATH, normalized);
  return normalized;
}

module.exports = {
  RECORDS_DOCUMENT_PATH,
  readRecordsDocument,
  writeRecordsDocument,
};
