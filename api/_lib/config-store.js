const { put, get } = require('@vercel/blob');
const { resolveToken } = require('./blob-store');

const FORMULAS_OVERRIDES_PATH = 'company-search/config/formulas.overrides.json';
const AGREEMENTS_RULES_PATH = 'company-search/config/agreements.rules.json';

function ensureToken() {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  return token;
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  const response = new Response(stream);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function readConfigJson(pathname, fallback = null) {
  const token = resolveToken();
  if (!token) return fallback;
  try {
    const result = await get(pathname, { access: 'private', token, useCache: false });
    if (!result || result.statusCode !== 200) return fallback;
    const buffer = await streamToBuffer(result.stream);
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    console.warn('[config-store] read failed:', pathname, error && error.message ? error.message : error);
    return fallback;
  }
}

async function writeConfigJson(pathname, value) {
  const token = ensureToken();
  await put(pathname, Buffer.from(JSON.stringify(value), 'utf8'), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });
}

module.exports = {
  FORMULAS_OVERRIDES_PATH,
  AGREEMENTS_RULES_PATH,
  readConfigJson,
  writeConfigJson,
};

