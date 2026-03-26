const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { evaluate } = require('../_lib/formulas-service');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }
  try {
    const body = await readJsonBody(req);
    const data = await evaluate(body || {}, { useDefaultsOnly: false });
    return sendJson(res, 200, { success: true, data });
  } catch (error) {
    console.error('[api/formulas/evaluate] failed:', error);
    return sendJson(res, 500, { success: false, message: error?.message || 'Failed to evaluate' });
  }
};

