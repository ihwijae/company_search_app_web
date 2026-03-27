const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { loadMerged, loadDefaults, loadOverrides, saveOverrides, evaluate } = require('../_lib/formulas-service');

function getGetAction(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const action = getGetAction(req);
    try {
      if (!action || action === 'load') {
        const data = await loadMerged();
        return sendJson(res, 200, { success: true, data });
      }
      if (action === 'defaults') {
        const data = loadDefaults();
        return sendJson(res, 200, { success: true, data });
      }
      if (action === 'load-overrides') {
        const data = await loadOverrides();
        return sendJson(res, 200, { success: true, data });
      }
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    } catch (error) {
      console.error('[api/formulas:index:get] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Request failed' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const action = String(body?.action || '').trim().toLowerCase();
      if (action === 'save-overrides') {
        await saveOverrides(body?.payload || {});
        return sendJson(res, 200, { success: true });
      }
      if (action === 'evaluate') {
        const data = await evaluate(body?.payload || {}, { useDefaultsOnly: false });
        return sendJson(res, 200, { success: true, data });
      }
      if (action === 'evaluate-defaults') {
        const data = await evaluate(body?.payload || {}, { useDefaultsOnly: true });
        return sendJson(res, 200, { success: true, data });
      }
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    } catch (error) {
      console.error('[api/formulas:index:post] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Request failed' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};
