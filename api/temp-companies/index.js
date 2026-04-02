const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const {
  readTempCompaniesDocument,
  writeTempCompaniesDocument,
  listCompaniesFromDocument,
  normalizeIndustry,
} = require('../_lib/temp-companies-store');

function getQueryParams(req) {
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams;
}

function normalizePayload(payload = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  return {
    id: source.id,
    name: String(source.name || '').trim(),
    industry: normalizeIndustry(source.industry),
    managerName: String(source.managerName || '').trim(),
    representative: String(source.representative || '').trim(),
    bizNo: String(source.bizNo || '').replace(/\D/g, ''),
    region: String(source.region || '').trim(),
    sipyung: String(source.sipyung || '').trim(),
    performance3y: String(source.performance3y || '').trim(),
    performance5y: String(source.performance5y || '').trim(),
    debtRatio: String(source.debtRatio || '').trim(),
    currentRatio: String(source.currentRatio || '').trim(),
    bizYears: String(source.bizYears || '').trim(),
    creditGrade: String(source.creditGrade || '').trim(),
    womenOwned: String(source.womenOwned || '').trim(),
    smallBusiness: String(source.smallBusiness || '').trim(),
    jobCreation: String(source.jobCreation || '').trim(),
    qualityEval: String(source.qualityEval || '').trim(),
    notes: String(source.notes || '').trim(),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const params = getQueryParams(req);
      const action = String(params.get('action') || 'list').trim().toLowerCase();
      const document = await readTempCompaniesDocument();
      if (action === 'get') {
        const targetId = Number(params.get('id'));
        const item = (document.companies || []).find((company) => company.id === targetId) || null;
        return sendJson(res, 200, { success: true, data: item });
      }
      const query = String(params.get('query') || '').trim();
      const industry = normalizeIndustry(params.get('industry') || '');
      const items = listCompaniesFromDocument(document, { query, industry });
      return sendJson(res, 200, { success: true, data: items });
    } catch (error) {
      console.error('[api/temp-companies:get] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Temp companies load failed' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const action = String(body?.action || 'save').trim().toLowerCase();
      const document = await readTempCompaniesDocument();

      if (action === 'save') {
        const payload = normalizePayload(body?.payload || {});
        if (!payload.name) {
          return sendJson(res, 400, { success: false, message: '업체명은 필수입니다.' });
        }
        const targetId = Number(payload.id);
        const now = new Date().toISOString();
        let saved;
        if (Number.isInteger(targetId) && targetId > 0) {
          const index = (document.companies || []).findIndex((item) => item.id === targetId);
          if (index >= 0) {
            saved = {
              ...document.companies[index],
              ...payload,
              id: targetId,
              createdAt: document.companies[index].createdAt || now,
              updatedAt: now,
            };
            document.companies[index] = saved;
          } else {
            saved = {
              ...payload,
              id: targetId,
              createdAt: now,
              updatedAt: now,
            };
            document.companies.push(saved);
            document.nextId = Math.max(document.nextId || 1, targetId + 1);
          }
        } else {
          const nextId = Number.isInteger(document.nextId) && document.nextId > 0 ? document.nextId : 1;
          saved = {
            ...payload,
            id: nextId,
            createdAt: now,
            updatedAt: now,
          };
          document.companies.push(saved);
          document.nextId = nextId + 1;
        }
        await writeTempCompaniesDocument(document);
        return sendJson(res, 200, { success: true, data: saved });
      }

      if (action === 'delete') {
        const targetId = Number(body?.id);
        const before = (document.companies || []).length;
        document.companies = (document.companies || []).filter((item) => item.id !== targetId);
        if (document.companies.length === before) {
          return sendJson(res, 404, { success: false, message: '삭제할 업체를 찾지 못했습니다.' });
        }
        await writeTempCompaniesDocument(document);
        return sendJson(res, 200, { success: true, data: true });
      }

      if (action === 'import') {
        const incoming = Array.isArray(body?.payload) ? body.payload : [];
        const now = new Date().toISOString();
        const normalized = incoming
          .map((item) => normalizePayload(item))
          .filter((item) => item.name);
        document.companies = normalized.map((item, index) => ({
          ...item,
          id: index + 1,
          createdAt: now,
          updatedAt: now,
        }));
        document.nextId = document.companies.length + 1;
        await writeTempCompaniesDocument(document);
        return sendJson(res, 200, {
          success: true,
          data: {
            importedCount: document.companies.length,
            replacedCount: document.companies.length,
          },
        });
      }

      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    } catch (error) {
      console.error('[api/temp-companies:post] failed:', error);
      return sendJson(res, 500, { success: false, message: error?.message || 'Temp companies save failed' });
    }
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};

