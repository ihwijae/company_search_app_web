const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const {
  saveAgreementBoard,
  listAgreementBoards,
  loadAgreementBoard,
  deleteAgreementBoard,
  updateAgreementBoardSmsStatus,
  AGREEMENT_BOARD_ROOT_LABEL,
  AGREEMENT_BOARD_ROOT_PATH,
} = require('../_lib/agreement-board-store');

function getGetAction(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const action = getGetAction(req);
    if (!action || action === 'list') {
      try {
        const data = await listAgreementBoards();
        return sendJson(res, 200, {
          success: true,
          data,
          path: AGREEMENT_BOARD_ROOT_PATH,
          label: AGREEMENT_BOARD_ROOT_LABEL,
        });
      } catch (error) {
        console.error('[api/agreement-board:index:list] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'List failed' });
      }
    }
    if (action === 'root') {
      return sendJson(res, 200, {
        success: true,
        path: AGREEMENT_BOARD_ROOT_PATH,
        label: AGREEMENT_BOARD_ROOT_LABEL,
        message: '웹에서는 서버 저장소를 사용합니다.',
      });
    }
    allowMethods(res, ['GET', 'POST']);
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const action = String(body?.action || '').trim().toLowerCase();
      if (action === 'save') {
        const payload = body?.payload || {};
        const data = await saveAgreementBoard(payload);
        return sendJson(res, 200, { success: true, data });
      }
      if (action === 'set-sms-status') {
        const pathname = body?.path ? String(body.path) : '';
        const status = body?.status;
        if (!pathname) {
          return sendJson(res, 400, { success: false, message: 'path is required' });
        }
        const data = await updateAgreementBoardSmsStatus(pathname, status);
        return sendJson(res, 200, { success: true, data });
      }
      if (action === 'load') {
        const pathname = body?.path ? String(body.path) : '';
        if (!pathname) {
          return sendJson(res, 400, { success: false, message: 'path is required' });
        }
        const data = await loadAgreementBoard(pathname);
        return sendJson(res, 200, { success: true, data });
      }
      if (action === 'delete') {
        const pathname = body?.path ? String(body.path) : '';
        if (!pathname) {
          return sendJson(res, 400, { success: false, message: 'path is required' });
        }
        await deleteAgreementBoard(pathname);
        return sendJson(res, 200, { success: true });
      }
      if (action === 'root') {
        return sendJson(res, 200, {
          success: true,
          path: AGREEMENT_BOARD_ROOT_PATH,
          label: AGREEMENT_BOARD_ROOT_LABEL,
          message: '웹에서는 서버 저장소를 사용합니다.',
        });
      }
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    } catch (error) {
      console.error('[api/agreement-board:index:post] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Request failed' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};
