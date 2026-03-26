const { sendJson, allowMethods } = require('../_lib/http');
const { getStatuses, readManifest, resolveToken } = require('../_lib/blob-store');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  if (!resolveToken()) {
    return sendJson(res, 200, {
      success: true,
      data: { eung: false, tongsin: false, sobang: false },
      meta: { configured: false, datasets: {} },
    });
  }

  try {
    const [statuses, manifest] = await Promise.all([getStatuses(), readManifest()]);
    return sendJson(res, 200, {
      success: true,
      data: statuses,
      meta: {
        configured: true,
        updatedAt: manifest.updatedAt || null,
        datasets: manifest.datasets || {},
      },
    });
  } catch (error) {
    console.error('[api/datasets/status] failed:', error);
    return sendJson(res, 500, { success: false, message: error && error.message ? error.message : 'Status lookup failed' });
  }
};
