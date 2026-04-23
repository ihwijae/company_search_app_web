const API_BASE = (import.meta.env.VITE_EXCEL_EDIT_API_BASE || 'http://127.0.0.1:8787').replace(/\/$/, '');
const DATASET_TYPE_MAP = {
  전기경영상태: 'eung',
  통신경영상태: 'tongsin',
  소방경영상태: 'sobang',
};

async function requestJson(path, { method = 'GET', body, headers } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(headers || {}),
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.detail || `요청 실패 (${response.status})`);
  }
  return payload;
}

const excelEditBackendClient = {
  getBaseUrl() {
    return API_BASE;
  },

  health() {
    return requestJson('/health');
  },

  uploadFiles({ files = [], fileType = '전기경영상태' } = {}) {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    form.append('fileType', fileType);
    return requestJson('/excel-edit/upload', {
      method: 'POST',
      body: form,
    });
  },

  updateYearEndColor(payload = {}) {
    return requestJson('/excel-edit/update-year-end-color', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCreditExpiry(payload = {}) {
    return requestJson('/excel-edit/update-credit-expiry', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  lookupCompany(payload = {}) {
    return requestJson('/excel-edit/company-lookup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  saveData({ payload = {}, files = [] } = {}) {
    const form = new FormData();
    form.append('payload', JSON.stringify(payload));
    files.forEach((file) => {
      if (file) form.append('files', file);
    });
    return requestJson('/excel-edit/save', {
      method: 'POST',
      body: form,
    });
  },

  async refreshUploadedDataset(fileType) {
    const mapped = DATASET_TYPE_MAP[fileType];
    if (!mapped) return { skipped: true };

    const response = await fetch(`/api/datasets?action=refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileType: mapped }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || `업로드 DB 재색인 실패 (${response.status})`);
    }
    return payload?.data || {};
  },

  async renderPdfPage({ file, page = 1, dpi = 160 } = {}) {
    const form = new FormData();
    form.append('file', file);
    form.append('page', String(page));
    form.append('dpi', String(dpi));

    const response = await fetch(`${API_BASE}/excel-edit/render-pdf-page`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || payload?.detail || `PDF 렌더 요청 실패 (${response.status})`);
    }

    const blob = await response.blob();
    return {
      blob,
      pageCount: Number(response.headers.get('x-pdf-page-count') || 0) || 0,
      pageNumber: Number(response.headers.get('x-pdf-page-number') || page) || page,
    };
  },

  async renderImage({ file } = {}) {
    const form = new FormData();
    form.append('file', file);

    const response = await fetch(`${API_BASE}/excel-edit/render-image`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || payload?.detail || `이미지 렌더 요청 실패 (${response.status})`);
    }
    const blob = await response.blob();
    return { blob };
  },
};

export default excelEditBackendClient;
