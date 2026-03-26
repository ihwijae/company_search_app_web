const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

const agreementsRulesClient = {
  async load() {
    return fetchJson('/api/agreements-rules?action=load');
  },

  async save(payload = {}) {
    return fetchJson('/api/agreements-rules', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save', payload: payload || {} }),
    });
  },
};

export default agreementsRulesClient;
