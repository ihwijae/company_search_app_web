const { sendJson, allowMethods } = require('../_lib/http');
const { listAgreementBoards, AGREEMENT_BOARD_ROOT_LABEL } = require('../_lib/agreement-board-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  try {
    const data = await listAgreementBoards();
    return sendJson(res, 200, {
      success: true,
      data,
      path: AGREEMENT_BOARD_ROOT_LABEL,
    });
  } catch (error) {
    console.error('[api/agreement-board/list] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'List failed' });
  }
};
