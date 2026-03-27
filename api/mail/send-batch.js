const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { sendBulkMail } = require('../../src/main/features/mail/smtpService.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  try {
    const body = await readJsonBody(req);
    const results = await sendBulkMail(body?.payload || {});
    return sendJson(res, 200, { success: true, results });
  } catch (error) {
    console.error('[api/mail/send-batch] failed:', error);
    return sendJson(res, 500, { success: false, message: error?.message || '메일 발송에 실패했습니다.' });
  }
};
