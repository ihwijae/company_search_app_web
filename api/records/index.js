const { get } = require('@vercel/blob');
const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { readRecordsDocument, writeRecordsDocument } = require('../_lib/records-store');
const { resolveToken } = require('../_lib/blob-store');

function getActionFromRequest(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const action = getActionFromRequest(req);
    if (!action || action === 'load') {
      try {
        const document = await readRecordsDocument();
        return sendJson(res, 200, { success: true, data: document });
      } catch (error) {
        console.error('[api/records:load] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'Load failed' });
      }
    }
    if (action === 'file') {
      const pathname = String(new URL(req.url, 'http://localhost').searchParams.get('pathname') || '').trim();
      if (!pathname) {
        return sendJson(res, 400, { success: false, message: 'pathname is required' });
      }
      const token = resolveToken();
      if (!token) {
        return sendJson(res, 500, { success: false, message: 'BLOB_READ_WRITE_TOKEN is not configured' });
      }
      try {
        const result = await get(pathname, {
          access: 'private',
          token,
          ifNoneMatch: req.headers['if-none-match'] || undefined,
        });
        if (!result || result.statusCode === 404) {
          return sendJson(res, 404, { success: false, message: 'File not found' });
        }
        if (result.statusCode === 304) {
          res.statusCode = 304;
          if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);
          res.setHeader('Cache-Control', 'private, no-cache');
          res.end();
          return;
        }

        res.statusCode = 200;
        if (result.contentType) res.setHeader('Content-Type', result.contentType);
        if (result.contentDisposition) {
          res.setHeader('Content-Disposition', result.contentDisposition);
        } else if (result.blob?.pathname) {
          const fileName = result.blob.pathname.split('/').pop();
          if (fileName) {
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`);
          }
        }
        if (result.cacheControl) res.setHeader('Cache-Control', result.cacheControl);
        if (result.blob?.etag) res.setHeader('ETag', result.blob.etag);
        if (result.blob?.size) res.setHeader('Content-Length', String(result.blob.size));

        if (!result.stream) {
          res.end();
          return;
        }
        for await (const chunk of result.stream) {
          res.write(chunk);
        }
        res.end();
        return;
      } catch (error) {
        console.error('[api/records:file] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'File load failed' });
      }
    }
    allowMethods(res, ['GET', 'POST']);
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const action = String(body?.action || '').trim().toLowerCase();
      if (action === 'save') {
        const document = await writeRecordsDocument(body?.document || {});
        return sendJson(res, 200, { success: true, data: document });
      }
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    } catch (error) {
      console.error('[api/records:post] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Request failed' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};
