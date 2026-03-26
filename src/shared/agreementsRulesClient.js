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

const agreementsRulesClient = {
  async load() {
    const api = getElectronApi();
    if (api?.agreementsRulesLoad) return api.agreementsRulesLoad();
    return fetchJson('/api/agreements-rules?action=load');
  },

  async save(payload = {}) {
    const api = getElectronApi();
    if (api?.agreementsRulesSave) return api.agreementsRulesSave(payload);
    return fetchJson('/api/agreements-rules', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save', payload: payload || {} }),
    });
  },
};

export default agreementsRulesClient;
