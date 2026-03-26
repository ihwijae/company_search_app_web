const { sendJson, allowMethods } = require('../_lib/http');
const { DATASET_TYPES, parseSharedDataset, resolveToken, getDatasetMeta, getDatasetVersion } = require('../_lib/blob-store');

const REGIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const regionsCache = new Map();

function readRegionsCache(key) {
  const cached = regionsCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.storedAt > REGIONS_CACHE_TTL_MS) {
    regionsCache.delete(key);
    return null;
  }
  return cached.value;
}

function writeRegionsCache(key, value) {
  regionsCache.set(key, {
    storedAt: Date.now(),
    value,
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  if (!resolveToken()) {
    return sendJson(res, 200, { success: true, data: ['전체'] });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const fileType = String(url.searchParams.get('fileType') || 'eung');
    if (fileType === 'all') {
      const metas = await Promise.all(DATASET_TYPES.map((type) => getDatasetMeta(type).catch(() => null)));
      const versionKey = metas.map((meta, index) => `${DATASET_TYPES[index]}:${getDatasetVersion(meta)}`).join('|');
      const cacheKey = `all:${versionKey}`;
      const cached = readRegionsCache(cacheKey);
      if (cached) {
        return sendJson(res, 200, { success: true, data: cached });
      }

      const set = new Set(['전체']);
      const datasets = await Promise.all(DATASET_TYPES.map((type) => parseSharedDataset(type).catch(() => null)));
      datasets.forEach((dataset) => {
        (dataset && dataset.sheetNames ? dataset.sheetNames : []).forEach((name) => set.add(name));
      });
      const data = Array.from(set);
      writeRegionsCache(cacheKey, data);
      return sendJson(res, 200, { success: true, data });
    }

    const meta = await getDatasetMeta(fileType);
    const versionKey = getDatasetVersion(meta);
    const cacheKey = `${fileType}:${versionKey}`;
    const cached = readRegionsCache(cacheKey);
    if (cached) {
      return sendJson(res, 200, { success: true, data: cached });
    }

    const dataset = await parseSharedDataset(fileType);
    const sheetNames = dataset && Array.isArray(dataset.sheetNames) ? dataset.sheetNames : [];
    const data = ['전체', ...sheetNames];
    writeRegionsCache(cacheKey, data);
    return sendJson(res, 200, { success: true, data });
  } catch (error) {
    console.error('[api/regions] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Region lookup failed' });
  }
};
