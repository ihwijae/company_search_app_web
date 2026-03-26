const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || '요청 실패');
  }
  return data;
}

const agreementBoardClient = {
  async save(payload) {
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save', payload: payload || {} }),
    });
  },

  async list() {
    return requestJson('/api/agreement-board?action=list');
  },

  async load(path) {
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'load', path }),
    });
  },

  async remove(path) {
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'delete', path }),
    });
  },

  async getRoot() {
    return requestJson('/api/agreement-board?action=root');
  },

  async pickRoot() {
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'root' }),
    });
  },
};

export default agreementBoardClient;
