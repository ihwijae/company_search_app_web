const { sendJson, allowMethods } = require('../_lib/http');
const { DATASET_TYPES, parseSharedDataset, resolveToken } = require('../_lib/blob-store');

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
      const set = new Set(['전체']);
      const datasets = await Promise.all(DATASET_TYPES.map((type) => parseSharedDataset(type).catch(() => null)));
      datasets.forEach((dataset) => {
        (dataset && dataset.sheetNames ? dataset.sheetNames : []).forEach((name) => set.add(name));
      });
      return sendJson(res, 200, { success: true, data: Array.from(set) });
    }

    const dataset = await parseSharedDataset(fileType);
    const sheetNames = dataset && Array.isArray(dataset.sheetNames) ? dataset.sheetNames : [];
    return sendJson(res, 200, { success: true, data: ['전체', ...sheetNames] });
  } catch (error) {
    console.error('[api/regions] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Region lookup failed' });
  }
};
