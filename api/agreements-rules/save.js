const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { saveRules } = require('../_lib/agreements-rules-service');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }
  try {
    const body = await readJsonBody(req);
    const result = await saveRules(body || {});
    if (!result.success) {
      return sendJson(res, 400, result);
    }
    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('[api/agreements-rules/save] failed:', error);
    return sendJson(res, 500, { success: false, message: error?.message || 'Failed to save rules' });
  }
};

