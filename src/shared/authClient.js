const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

const authClient = {
  async getSession() {
    return requestJson('/api/auth?action=session');
  },

  async login({ id, password }) {
    return requestJson('/api/auth?action=login', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ id, password }),
    });
  },

  async logout() {
    return requestJson('/api/auth?action=logout', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({}),
    });
  },
};

export default authClient;
