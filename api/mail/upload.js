const { readJsonBody } = require('../_lib/http');
const { ROOTS, ensureDir, sanitizeFileName, writeBinaryFile } = require('../_lib/local-storage');

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
    const fileName = sanitizeFileName(body?.fileName || 'attachment');
    const fileBase64 = String(body?.fileBase64 || '').trim();
    const contentType = String(body?.contentType || 'application/octet-stream').trim();
    const pathname = `${Date.now()}-${fileName}`;

    if (!fileBase64) {
      throw new Error('file payload is required');
    }

    await ensureDir(ROOTS.mailAttachments);
    await writeBinaryFile(ROOTS.mailAttachments, pathname, Buffer.from(fileBase64, 'base64'));

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: true,
      pathname,
      contentType,
    }));
  } catch (error) {
    console.error('[api/mail/upload] failed:', error);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error?.message || 'Upload failed' }));
  }
};
