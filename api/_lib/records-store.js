const { put, get } = require('@vercel/blob');
const { resolveToken } = require('./blob-store');

const RECORDS_DOCUMENT_PATH = 'company-search/records/index.json';

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  const response = new Response(stream);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function ensureToken() {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  return token;
}

async function readRecordsDocument() {
  const token = resolveToken();
  if (!token) return null;
  try {
    const result = await get(RECORDS_DOCUMENT_PATH, { access: 'private', token, useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const buffer = await streamToBuffer(result.stream);
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    console.warn('[records-store] read failed:', error && error.message ? error.message : error);
    return null;
  }
}

async function writeRecordsDocument(document) {
  const token = ensureToken();
  const normalized = document && typeof document === 'object' ? document : {};
  await put(RECORDS_DOCUMENT_PATH, Buffer.from(JSON.stringify(normalized), 'utf8'), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });
  return normalized;
}

module.exports = {
  RECORDS_DOCUMENT_PATH,
  readRecordsDocument,
  writeRecordsDocument,
};
