const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { loadMailAddressBook, saveMailAddressBook } = require('../_lib/mail-address-book-store');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const data = await loadMailAddressBook([]);
      return sendJson(res, 200, { success: true, data });
    } catch (error) {
      console.error('[api/mail-address-book:get] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Address book load failed' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const data = await saveMailAddressBook(body?.payload || []);
      return sendJson(res, 200, { success: true, data });
    } catch (error) {
      console.error('[api/mail-address-book:post] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Address book save failed' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};
