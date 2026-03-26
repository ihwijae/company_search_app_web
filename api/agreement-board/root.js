const { sendJson, allowMethods } = require('../_lib/http');
const { AGREEMENT_BOARD_ROOT_LABEL } = require('../_lib/agreement-board-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    allowMethods(res, ['GET', 'POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  return sendJson(res, 200, {
    success: true,
    path: AGREEMENT_BOARD_ROOT_LABEL,
    message: '웹에서는 서버 저장소를 사용합니다.',
  });
};
