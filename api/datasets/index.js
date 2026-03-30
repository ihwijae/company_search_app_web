const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const {
  getStatuses,
  readManifest,
  resolveToken,
  DATASET_TYPES,
  parseSharedDataset,
  getDatasetMeta,
  getDatasetVersion,
  uploadDataset,
} = require('../_lib/blob-store');

function getAction(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const action = getAction(req);

    if (!action || action === 'status') {
      if (!resolveToken()) {
        return sendJson(res, 200, {
          success: true,
          data: { eung: false, tongsin: false, sobang: false },
          meta: { configured: false, datasets: {} },
        });
      }

      try {
        const [statuses, manifest] = await Promise.all([getStatuses(), readManifest()]);
        return sendJson(res, 200, {
          success: true,
          data: statuses,
          meta: {
            configured: true,
            updatedAt: manifest.updatedAt || null,
            datasets: manifest.datasets || {},
          },
        });
      } catch (error) {
        console.error('[api/datasets:index:status] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'Status lookup failed' });
      }
    }

    if (action === 'snapshot') {
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
        console.error('[api/datasets:index:snapshot] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'Snapshot failed' });
      }
    }

    allowMethods(res, ['GET', 'POST']);
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  if (req.method === 'POST') {
    const action = getAction(req);
    if (action !== 'upload') {
      allowMethods(res, ['GET', 'POST']);
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    }

    if (!resolveToken()) {
      return sendJson(res, 500, { success: false, message: 'BLOB_READ_WRITE_TOKEN is not configured' });
    }

    try {
      const body = await readJsonBody(req);
      const fileType = body.fileType;
      const fileName = body.fileName || `${fileType}.xlsx`;
      const contentType = body.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const fileBase64 = body.fileBase64 || '';

      if (!DATASET_TYPES.includes(fileType)) {
        return sendJson(res, 400, { success: false, message: 'Invalid dataset type' });
      }
      if (!fileBase64) {
        return sendJson(res, 400, { success: false, message: 'File payload is required' });
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      const result = await uploadDataset({ fileType, fileName, buffer, contentType });
      return sendJson(res, 200, {
        success: true,
        data: {
          fileType,
          fileName,
          pathname: result.uploaded.pathname,
          uploadedAt: result.manifest.updatedAt,
        },
      });
    } catch (error) {
      console.error('[api/datasets:index:upload] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Upload failed' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};
