const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { uploadDataset, DATASET_TYPES, resolveToken } = require('../_lib/blob-store');

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
    console.error('[api/datasets/upload] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Upload failed' });
  }
};
