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
    return fetchJson('/api/formulas?action=load');
  },

  async loadDefaults() {
    const api = getElectronApi();
    if (api?.formulasLoadDefaults) return api.formulasLoadDefaults();
    return fetchJson('/api/formulas?action=defaults');
  },

  async loadOverrides() {
    const api = getElectronApi();
    if (api?.formulasLoadOverrides) return api.formulasLoadOverrides({});
    return fetchJson('/api/formulas?action=load-overrides');
  },

  async saveOverrides(payload = {}) {
    const api = getElectronApi();
    if (api?.formulasSaveOverrides) return api.formulasSaveOverrides(payload);
    return fetchJson('/api/formulas', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save-overrides', payload: payload || {} }),
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
    return fetchJson('/api/formulas', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        action: useDefaultsOnly ? 'evaluate-defaults' : 'evaluate',
        payload: payload || {},
      }),
    });
  },
};

export default formulasClient;
