const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { DATASET_TYPES, parseSharedDataset, resolveToken } = require('../_lib/blob-store');
const { searchCompaniesInDataset } = require('../_lib/dataset-parser');

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
      const datasets = await Promise.all(DATASET_TYPES.map((type) => parseSharedDataset(type).catch(() => null)));
      const merged = [];
      datasets.forEach((dataset, index) => {
        const currentType = DATASET_TYPES[index];
        if (!dataset || !Array.isArray(dataset.companies)) return;
        dataset.companies.forEach((item) => merged.push({ ...item, _file_type: currentType }));
      });
      const filtered = searchCompaniesInDataset(merged, criteria, options || {});
      return sendJson(res, 200, { success: true, data: filtered.items, meta: filtered.meta });
    }

    const dataset = await parseSharedDataset(fileType);
    if (!dataset || !Array.isArray(dataset.companies) || dataset.companies.length === 0) {
      return sendJson(res, 200, { success: false, message: `${fileType} 파일이 로드되지 않았습니다` });
    }
    const processed = searchCompaniesInDataset(dataset.companies, criteria, options || {});
    return sendJson(res, 200, { success: true, data: processed.items, meta: processed.meta });
  } catch (error) {
    console.error('[api/search] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Search failed' });
  }
};
