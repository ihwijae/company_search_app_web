const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

function getElectronApi() {
  if (typeof window === 'undefined') return null;
  return window.electronAPI || null;
}

const formulasClient = {
  async load() {
    const api = getElectronApi();
    if (api?.formulasLoad) return api.formulasLoad();
    return fetchJson('/api/formulas/load');
  },

  async loadDefaults() {
    const api = getElectronApi();
    if (api?.formulasLoadDefaults) return api.formulasLoadDefaults();
    return fetchJson('/api/formulas/defaults');
  },

  async loadOverrides() {
    const api = getElectronApi();
    if (api?.formulasLoadOverrides) return api.formulasLoadOverrides({});
    return fetchJson('/api/formulas/load-overrides');
  },

  async saveOverrides(payload = {}) {
    const api = getElectronApi();
    if (api?.formulasSaveOverrides) return api.formulasSaveOverrides(payload);
    return fetchJson('/api/formulas/save-overrides', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload || {}),
    });
  },

  async evaluate(payload = {}, { useDefaultsOnly = false } = {}) {
    const api = getElectronApi();
    if (useDefaultsOnly && api?.excelHelperFormulasEvaluate) {
      return api.excelHelperFormulasEvaluate(payload);
    }
    if (!useDefaultsOnly && api?.formulasEvaluate) {
      return api.formulasEvaluate(payload);
    }
    return fetchJson(useDefaultsOnly ? '/api/formulas/evaluate-defaults' : '/api/formulas/evaluate', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(payload || {}),
    });
  },
};

export default formulasClient;

