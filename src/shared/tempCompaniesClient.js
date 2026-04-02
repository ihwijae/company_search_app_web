const ensureApi = () => {
  if (typeof window === 'undefined') return null;
  const api = window.electronAPI?.tempCompanies
    || window.opener?.electronAPI?.tempCompanies
    || null;
  return api;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || payload?.error || '요청 실패');
  }
  return payload;
}

const wrapInvoke = async (method, ...args) => {
  const api = ensureApi();
  if (!api || typeof api[method] !== 'function') {
    throw new Error(`tempCompanies API method ${method} is not available`);
  }
  const response = await api[method](...args);
  if (!response || response.success === undefined) return response;
  if (response.success) return response.data;
  const error = new Error(response.error || 'TempCompanies API call failed');
  error.payload = response;
  throw error;
};

export const tempCompaniesClient = {
  async listCompanies(filters = {}) {
    const api = ensureApi();
    if (api) return wrapInvoke('list', filters);
    const params = new URLSearchParams({ action: 'list' });
    if (filters?.query) params.set('query', String(filters.query));
    if (filters?.industry) params.set('industry', String(filters.industry));
    const result = await requestJson(`/api/temp-companies?${params.toString()}`);
    return result?.data || [];
  },

  async getCompany(id) {
    const api = ensureApi();
    if (api) return wrapInvoke('get', id);
    const params = new URLSearchParams({ action: 'get', id: String(id || '') });
    const result = await requestJson(`/api/temp-companies?${params.toString()}`);
    return result?.data || null;
  },

  async saveCompany(payload) {
    const api = ensureApi();
    if (api) return wrapInvoke('save', payload);
    const result = await requestJson('/api/temp-companies', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save', payload: payload || {} }),
    });
    return result?.data || null;
  },

  async deleteCompany(id) {
    const api = ensureApi();
    if (api) return wrapInvoke('delete', id);
    const result = await requestJson('/api/temp-companies', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'delete', id }),
    });
    return Boolean(result?.data);
  },

  async openWindow(payload) {
    const api = ensureApi();
    if (api) return wrapInvoke('openWindow', payload);
    return { success: true };
  },

  async exportCompanies() {
    const api = ensureApi();
    if (api) return wrapInvoke('exportData');
    const list = await this.listCompanies({});
    const rows = Array.isArray(list) ? list : [];
    const payload = rows.map(({ id, createdAt, updatedAt, ...rest }) => rest);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `temp-companies-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    return { canceled: false, count: rows.length };
  },

  async importCompanies() {
    const api = ensureApi();
    if (api) return wrapInvoke('importData');

    const file = await new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.onchange = () => {
        const selected = input.files && input.files[0] ? input.files[0] : null;
        input.remove();
        resolve(selected);
      };
      input.click();
    });

    if (!file) return { canceled: true };
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('배열(JSON) 형식의 임시업체 파일만 가져올 수 있습니다.');
    }

    const result = await requestJson('/api/temp-companies', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'import', payload: parsed }),
    });
    return {
      canceled: false,
      importedCount: Number(result?.data?.importedCount || 0),
      replacedCount: Number(result?.data?.replacedCount || 0),
    };
  },
};

export default tempCompaniesClient;
