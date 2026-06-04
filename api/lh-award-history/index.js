const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { loadLhAwardHistory, saveLhAwardHistory } = require('../_lib/lh-award-history-service');

function getGetAction(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const action = getGetAction(req);
    if (!action || action === 'load') {
      try {
        const data = await loadLhAwardHistory();
        return sendJson(res, 200, { success: true, data });
      } catch (error) {
        console.error('[api/lh-award-history:load] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'Failed to load award history' });
      }
    }
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const action = String(body?.action || '').trim().toLowerCase();
      if (action === 'save') {
        const result = await saveLhAwardHistory(body?.payload || {});
        return sendJson(res, 200, { success: true, data: { entries: result.entries } });
      }
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    } catch (error) {
      console.error('[api/lh-award-history:post] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Failed to save award history' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};
