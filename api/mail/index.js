const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { sendTestMail, sendBulkMail } = require('../../src/main/features/mail/smtpService.js');

function getAction(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  const action = getAction(req);
  try {
    const body = await readJsonBody(req);
    if (action === 'send-test') {
      const result = await sendTestMail(body?.payload || {});
      return sendJson(res, 200, { success: true, data: result });
    }
    if (action === 'send-batch') {
      const results = await sendBulkMail(body?.payload || {});
      return sendJson(res, 200, { success: true, results });
    }
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  } catch (error) {
    console.error('[api/mail:index] failed:', error);
    const fallbackMessage = action === 'send-test'
      ? '테스트 메일 발송에 실패했습니다.'
      : '메일 발송에 실패했습니다.';
    return sendJson(res, 500, { success: false, message: error?.message || fallbackMessage });
  }
};
