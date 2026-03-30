const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { readRecordsDocument, writeRecordsDocument } = require('../_lib/records-store');

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
