const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { DATASET_TYPES, parseSharedDataset, resolveToken, getDatasetMeta, getDatasetVersion } = require('../_lib/blob-store');
const { searchCompaniesInDataset } = require('../_lib/dataset-parser');

const SEARCH_CACHE_TTL_MS = 60 * 1000;
const searchCache = new Map();

function readSearchCache(key) {
  const cached = searchCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.storedAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeSearchCache(key, value) {
  searchCache.set(key, {
    storedAt: Date.now(),
    value,
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  if (!resolveToken()) {
    return sendJson(res, 500, { success: false, message: 'BLOB_READ_WRITE_TOKEN is not configured' });
  }

  try {
    const body = await readJsonBody(req);
    const criteria = typeof body.criteria === 'string' ? JSON.parse(body.criteria) : (body.criteria || {});
    const options = typeof body.options === 'string' ? JSON.parse(body.options) : (body.options || {});
    const fileType = String(body.fileType || 'eung');

    if (fileType === 'all') {
      const metas = await Promise.all(DATASET_TYPES.map((type) => getDatasetMeta(type).catch(() => null)));
      const versionKey = metas.map((meta, index) => `${DATASET_TYPES[index]}:${getDatasetVersion(meta)}`).join('|');
      const cacheKey = JSON.stringify({ fileType, criteria, options, versionKey });
      const cached = readSearchCache(cacheKey);
      if (cached) {
        return sendJson(res, 200, cached);
      }

      const datasets = await Promise.all(DATASET_TYPES.map((type) => parseSharedDataset(type).catch(() => null)));
      const merged = [];
      datasets.forEach((dataset, index) => {
        const currentType = DATASET_TYPES[index];
        if (!dataset || !Array.isArray(dataset.companies)) return;
        dataset.companies.forEach((item) => merged.push({ ...item, _file_type: currentType }));
      });
      const filtered = searchCompaniesInDataset(merged, criteria, options || {});
      const response = { success: true, data: filtered.items, meta: filtered.meta };
      writeSearchCache(cacheKey, response);
      return sendJson(res, 200, response);
    }

    const meta = await getDatasetMeta(fileType);
    const versionKey = getDatasetVersion(meta);
    const cacheKey = JSON.stringify({ fileType, criteria, options, versionKey });
    const cached = readSearchCache(cacheKey);
    if (cached) {
      return sendJson(res, 200, cached);
    }

    const dataset = await parseSharedDataset(fileType);
    if (!dataset || !Array.isArray(dataset.companies) || dataset.companies.length === 0) {
      return sendJson(res, 200, { success: false, message: `${fileType} 파일이 로드되지 않았습니다` });
    }
    const processed = searchCompaniesInDataset(dataset.companies, criteria, options || {});
    const response = { success: true, data: processed.items, meta: processed.meta };
    writeSearchCache(cacheKey, response);
    return sendJson(res, 200, response);
  } catch (error) {
    console.error('[api/search] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Search failed' });
  }
};
