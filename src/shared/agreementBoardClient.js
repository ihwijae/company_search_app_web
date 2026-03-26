const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || '요청 실패');
  }
  return data;
}

function supportsElectronAgreementBoard() {
  return typeof window !== 'undefined'
    && !!window.electronAPI?.agreementBoardSave
    && !!window.electronAPI?.agreementBoardList
    && !!window.electronAPI?.agreementBoardLoad
    && !!window.electronAPI?.agreementBoardDelete;
}

const agreementBoardClient = {
  supportsElectronAgreementBoard,

  async save(payload) {
    if (supportsElectronAgreementBoard()) {
      return window.electronAPI.agreementBoardSave(payload);
    }
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save', payload: payload || {} }),
    });
  },

  async list() {
    if (supportsElectronAgreementBoard()) {
      return window.electronAPI.agreementBoardList();
    }
    return requestJson('/api/agreement-board?action=list');
  },

  async load(path) {
    if (supportsElectronAgreementBoard()) {
      return window.electronAPI.agreementBoardLoad(path);
    }
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'load', path }),
    });
  },

  async remove(path) {
    if (supportsElectronAgreementBoard()) {
      return window.electronAPI.agreementBoardDelete(path);
    }
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'delete', path }),
    });
  },

  async getRoot() {
    if (typeof window !== 'undefined' && window.electronAPI?.agreementBoardGetRoot) {
      return window.electronAPI.agreementBoardGetRoot();
    }
    return requestJson('/api/agreement-board?action=root');
  },

  async pickRoot() {
    if (typeof window !== 'undefined' && window.electronAPI?.agreementBoardPickRoot) {
      return window.electronAPI.agreementBoardPickRoot();
    }
    return requestJson('/api/agreement-board', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'root' }),
    });
  },
};

export default agreementBoardClient;
