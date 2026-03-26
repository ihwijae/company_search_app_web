const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { loadRules, saveRules } = require('../_lib/agreements-rules-service');

function getGetAction(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const action = getGetAction(req);
    if (!action || action === 'load') {
      try {
        const data = await loadRules();
        return sendJson(res, 200, { success: true, data });
      } catch (error) {
        console.error('[api/agreements-rules:index:load] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'Failed to load rules' });
      }
    }
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const action = String(body?.action || '').trim().toLowerCase();
      if (action === 'save') {
        const result = await saveRules(body?.payload || {});
        if (!result.success) {
          return sendJson(res, 400, result);
        }
        return sendJson(res, 200, { success: true });
      }
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    } catch (error) {
      console.error('[api/agreements-rules:index:post] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Failed to save rules' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};

