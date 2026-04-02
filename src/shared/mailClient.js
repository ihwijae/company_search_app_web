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
    return requestJson('/api/mail?action=send-test', {
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
    return requestJson('/api/mail?action=send-batch', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ payload: payload || {} }),
    });
  },

  async uploadAttachment(file, options = {}) {
    if (!(file instanceof File)) {
      throw new Error('업로드할 파일이 올바르지 않습니다.');
    }
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    const data = await requestJson('/api/mail/upload', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        fileName: options.fileName || file.name,
        contentType: file.type || 'application/octet-stream',
        fileBase64: btoa(binary),
      }),
    });
    return data;
  },
};

export default mailClient;
