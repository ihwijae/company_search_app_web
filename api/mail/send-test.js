const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { sendTestMail } = require('../../src/main/features/mail/smtpService.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const result = await sendTestMail(body?.payload || {});
    return sendJson(res, 200, { success: true, data: result });
  } catch (error) {
    console.error('[api/mail/send-test] failed:', error);
    return sendJson(res, 500, { success: false, message: error?.message || '테스트 메일 발송에 실패했습니다.' });
  }
};
