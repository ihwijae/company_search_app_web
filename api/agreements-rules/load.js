const { sendJson, allowMethods } = require('../_lib/http');
const { loadRules } = require('../_lib/agreements-rules-service');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }
  try {
    const data = await loadRules();
    return sendJson(res, 200, { success: true, data });
  } catch (error) {
    console.error('[api/agreements-rules/load] failed:', error);
    return sendJson(res, 500, { success: false, message: error?.message || 'Failed to load rules' });
  }
};

