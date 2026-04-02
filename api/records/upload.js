const path = require('path');
const { readJsonBody } = require('../_lib/http');
const { ROOTS, ensureDir, sanitizeFileName, resolveWithinRoot, writeBinaryFile } = require('../_lib/local-storage');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const projectId = String(body?.projectId || '').trim();
    const attachmentId = String(body?.attachmentId || '').trim();
    const fileName = sanitizeFileName(body?.fileName || 'attachment');
    const fileBase64 = String(body?.fileBase64 || '').trim();
    const contentType = String(body?.contentType || 'application/octet-stream').trim();

    if (!projectId || !attachmentId || !fileBase64) {
      throw new Error('projectId, attachmentId, file payload are required');
    }

    await ensureDir(ROOTS.recordAttachments);
    const relativePath = path.join(projectId, `${attachmentId}-${fileName}`);
    const absolutePath = await writeBinaryFile(ROOTS.recordAttachments, relativePath, Buffer.from(fileBase64, 'base64'));
    const pathname = path.relative(ROOTS.recordAttachments, absolutePath).split(path.sep).join('/');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: true,
      pathname,
      filePath: `/api/records?action=file&pathname=${encodeURIComponent(pathname)}`,
      contentType,
    }));
  } catch (error) {
    console.error('[api/records/upload] failed:', error);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error?.message || 'Upload failed' }));
  }
};
