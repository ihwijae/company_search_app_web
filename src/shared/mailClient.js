const JSON_HEADERS = { 'Content-Type': 'application/json' };

function getElectronMailApi() {
  if (typeof window === 'undefined') return null;
  return window.electronAPI?.mail || null;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || '요청 실패');
  }
  return data;
}

const mailClient = {
  supportsProgress() {
    const api = getElectronMailApi();
    return typeof api?.onProgress === 'function';
  },

  onProgress(channel, callback) {
    const api = getElectronMailApi();
    if (typeof api?.onProgress === 'function') {
      return api.onProgress(channel, callback);
    }
    return () => {};
  },

  async sendTest(payload) {
    const api = getElectronMailApi();
    if (typeof api?.sendTest === 'function') {
      return api.sendTest(payload);
    }
    return requestJson('/api/mail/send-test', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ payload: payload || {} }),
    });
  },

  async sendBatch(payload) {
    const api = getElectronMailApi();
    if (typeof api?.sendBatch === 'function') {
      return api.sendBatch(payload);
    }
    return requestJson('/api/mail/send-batch', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ payload: payload || {} }),
    });
  },
};

export default mailClient;
