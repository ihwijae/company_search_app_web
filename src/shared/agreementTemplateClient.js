const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || '요청 실패');
  }
  return data;
}

async function readFileAsBase64(file) {
  const arrayBuffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

const agreementTemplateClient = {
  async list() {
    return requestJson('/api/agreement-board?action=template-list');
  },

  async upload({ templateKey, file }) {
    if (!templateKey) throw new Error('templateKey is required');
    if (!(file instanceof File)) throw new Error('file is required');
    const fileBase64 = await readFileAsBase64(file);
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        action: 'template-upload',
        templateKey,
        fileName: file.name,
        contentType: file.type,
        fileBase64,
      }),
    });
  },

  async remove(templateKey) {
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({
        action: 'template-delete',
        templateKey,
      }),
    });
  },
};

export default agreementTemplateClient;

