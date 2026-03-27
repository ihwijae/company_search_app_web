const { sendJson, allowMethods } = require('../_lib/http');
const { DATASET_TYPES, parseSharedDataset, getDatasetMeta, getDatasetVersion, resolveToken } = require('../_lib/blob-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  if (!resolveToken()) {
    return sendJson(res, 500, { success: false, message: 'BLOB_READ_WRITE_TOKEN is not configured' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const fileType = String(url.searchParams.get('fileType') || '').trim().toLowerCase();
    if (!DATASET_TYPES.includes(fileType)) {
      return sendJson(res, 400, { success: false, message: 'Invalid dataset type' });
    }

    const meta = await getDatasetMeta(fileType);
    const dataset = await parseSharedDataset(fileType);
    if (!meta || !dataset) {
      return sendJson(res, 404, { success: false, message: `${fileType} dataset is not available` });
    }

    return sendJson(res, 200, {
      success: true,
      data: {
        ...dataset,
        type: fileType,
        fileName: dataset.fileName || meta.fileName || '',
        updatedAt: dataset.updatedAt || meta.uploadedAt || null,
        version: getDatasetVersion(meta),
      },
    });
  } catch (error) {
    console.error('[api/datasets/snapshot] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Snapshot failed' });
  }
};
