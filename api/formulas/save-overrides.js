const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { saveOverrides } = require('../_lib/formulas-service');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }
  try {
    const body = await readJsonBody(req);
    await saveOverrides(body || {});
    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('[api/formulas/save-overrides] failed:', error);
    return sendJson(res, 500, { success: false, message: error?.message || 'Failed to save overrides' });
  }
};

