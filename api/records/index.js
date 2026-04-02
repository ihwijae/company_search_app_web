const fs = require('fs');
const path = require('path');
const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { readRecordsDocument, writeRecordsDocument } = require('../_lib/records-store');
const { ROOTS, resolveWithinRoot } = require('../_lib/local-storage');

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
      try {
        const filePath = resolveWithinRoot(ROOTS.recordAttachments, pathname);
        const stat = await fs.promises.stat(filePath).catch(() => null);
        if (!stat || !stat.isFile()) {
          return sendJson(res, 404, { success: false, message: 'File not found' });
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`);
        res.setHeader('Content-Length', String(stat.size));
        fs.createReadStream(filePath).pipe(res);
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
