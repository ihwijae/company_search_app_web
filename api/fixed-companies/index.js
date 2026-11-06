const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { loadFixedCompanies, saveFixedCompanyGroup } = require('../_lib/fixed-companies-store');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    allowMethods(res, ['GET', 'POST']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }
  try {
    const data = req.method === 'GET'
      ? await loadFixedCompanies()
      : await saveFixedCompanyGroup(await readJsonBody(req));
    return sendJson(res, 200, { success: true, data });
  } catch (error) {
    return sendJson(res, error.status || (error instanceof SyntaxError ? 400 : 500), {
      success: false, message: error.message || '고정업체 설정을 처리하지 못했습니다.',
    });
  }
};
