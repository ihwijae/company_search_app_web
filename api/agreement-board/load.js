const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { loadAgreementBoard } = require('../_lib/agreement-board-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const pathname = body && body.path ? String(body.path) : '';
    if (!pathname) {
      return sendJson(res, 400, { success: false, message: 'path is required' });
    }
    const data = await loadAgreementBoard(pathname);
    return sendJson(res, 200, { success: true, data });
  } catch (error) {
    console.error('[api/agreement-board/load] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Load failed' });
  }
};
