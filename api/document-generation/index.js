const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const { listDocuments, loadDocument, saveDocument, deleteDocument } = require('../_lib/document-generation-store');

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    allowMethods(res, ['GET', 'POST', 'DELETE']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    const data = req.method === 'POST'
      ? await saveDocument(await readJsonBody(req))
      : req.method === 'DELETE' ? await deleteDocument(await readJsonBody(req))
        : url.searchParams.has('id') ? await loadDocument(url.searchParams.get('id')) : await listDocuments();
    return sendJson(res, 200, { success: true, data });
  } catch (error) {
    return sendJson(res, error.status || (error instanceof SyntaxError ? 400 : 500), {
      success: false, message: error.message || '서류 저장정보를 처리하지 못했습니다.',
    });
  }
};
