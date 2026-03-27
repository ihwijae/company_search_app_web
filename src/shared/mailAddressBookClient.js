const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || '요청 실패');
  }
  return data;
}

const mailAddressBookClient = {
  async load() {
    return requestJson('/api/mail-address-book');
  },

  async save(payload = []) {
    return requestJson('/api/mail-address-book', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ payload }),
    });
  },
};

export default mailAddressBookClient;
