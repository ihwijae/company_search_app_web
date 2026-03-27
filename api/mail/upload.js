const { handleUpload } = require('@vercel/blob/client');
const { resolveToken } = require('../_lib/blob-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const token = resolveToken();
  if (!token) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'BLOB_READ_WRITE_TOKEN is not configured' }));
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const jsonResponse = await handleUpload({
      token,
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: [
          'application/pdf',
          'application/zip',
          'application/x-zip-compressed',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/png',
          'image/jpeg',
          'image/gif',
          'text/plain',
        ],
        addRandomSuffix: true,
        allowOverwrite: false,
        access: 'private',
      }),
    });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(jsonResponse));
  } catch (error) {
    console.error('[api/mail/upload] failed:', error);
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: error?.message || 'Upload failed' }));
  }
};
