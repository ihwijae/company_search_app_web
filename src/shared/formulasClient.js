const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

const formulasClient = {
  async load() {
    return fetchJson('/api/formulas?action=load');
  },

  async loadDefaults() {
    return fetchJson('/api/formulas?action=defaults');
  },

  async loadOverrides() {
    return fetchJson('/api/formulas?action=load-overrides');
  },

  async saveOverrides(payload = {}) {
    return fetchJson('/api/formulas', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save-overrides', payload: payload || {} }),
    });
  },

  async evaluate(payload = {}, { useDefaultsOnly = false } = {}) {
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
