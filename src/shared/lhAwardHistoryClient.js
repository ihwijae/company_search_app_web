const JSON_HEADERS = { 'Content-Type': 'application/json' };

const getResolvedWindow = (sourceDocument = null) => {
  if (sourceDocument?.defaultView) return sourceDocument.defaultView;
  if (typeof window !== 'undefined') return window;
  return null;
};

const getResolvedDocument = (sourceDocument = null) => {
  if (sourceDocument) return sourceDocument;
  if (typeof document !== 'undefined') return document;
  return null;
};

const createJsonDownload = (payload, fileName, sourceDocument = null) => {
  const resolvedWindow = getResolvedWindow(sourceDocument);
  const resolvedDocument = getResolvedDocument(sourceDocument);
  if (!resolvedWindow || !resolvedDocument) {
    throw new Error('내보내기 문서를 찾을 수 없습니다.');
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = resolvedWindow.URL.createObjectURL(blob);
  const anchor = resolvedDocument.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  resolvedDocument.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  resolvedWindow.setTimeout(() => resolvedWindow.URL.revokeObjectURL(url), 1000);
};

const pickJsonFile = (sourceDocument = null) => new Promise((resolve) => {
  const resolvedWindow = getResolvedWindow(sourceDocument);
  const resolvedDocument = getResolvedDocument(sourceDocument);
  if (!resolvedWindow || !resolvedDocument) {
    resolve(null);
    return;
  }
  const input = resolvedDocument.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  resolvedDocument.body.appendChild(input);
  input.onchange = () => {
    const selected = input.files && input.files[0] ? input.files[0] : null;
    input.remove();
    resolve(selected);
  };
  try {
    input.click();
  } catch {
    input.remove();
    resolve(null);
  }
});

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

const lhAwardHistoryClient = {
  async load() {
    const payload = await fetchJson('/api/lh-award-history?action=load');
    return payload?.data || { entries: [] };
  },

  async save(entries = []) {
    const payload = await fetchJson('/api/lh-award-history', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save', payload: { entries } }),
    });
    return payload?.data || { entries };
  },

  async exportData(entries = [], options = {}) {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: Array.isArray(entries) ? entries : [],
    };
    createJsonDownload(
      payload,
      `lh-award-history-${new Date().toISOString().slice(0, 10)}.json`,
      options?.document || null,
    );
    return { canceled: false, count: payload.entries.length };
  },

  async importData(options = {}) {
    const file = await pickJsonFile(options?.document || null);
    if (!file) return { canceled: true, entries: [] };

    const text = await file.text();
    const parsed = JSON.parse(text);
    const entries = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed?.entries) ? parsed.entries : null);

    if (!Array.isArray(entries)) {
      throw new Error('가져온 파일 형식이 올바르지 않습니다.');
    }

    return {
      canceled: false,
      entries,
      fileName: file.name,
    };
  },
};

export default lhAwardHistoryClient;
