async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.message || `요청 실패 (${response.status})`);
  }
  return payload;
}

const scanArchiveClient = {
  async list(dir = '') {
    const query = new URLSearchParams({ action: 'list' });
    if (dir) query.set('dir', dir);
    return requestJson(`/api/scan-archive?${query.toString()}`);
  },

  buildPreviewUrl(path) {
    const query = new URLSearchParams({ action: 'file', path });
    return `/api/scan-archive?${query.toString()}`;
  },

  buildDownloadUrl(path) {
    const query = new URLSearchParams({ action: 'file', path, download: '1' });
    return `/api/scan-archive?${query.toString()}`;
  },

  buildDownloadAllUrl(dir = '') {
    const query = new URLSearchParams({ action: 'download-all' });
    if (dir) query.set('dir', dir);
    return `/api/scan-archive?${query.toString()}`;
  },

  async search(query, fileType = 'all') {
    const params = new URLSearchParams({ action: 'search', q: query, fileType });
    return requestJson(`/api/scan-archive?${params.toString()}`);
  },

  async createFolder(dir, name) {
    const params = new URLSearchParams({ action: 'create-folder' });
    return requestJson(`/api/scan-archive?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ dir, name }),
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async renameFolder(path, name) {
    const params = new URLSearchParams({ action: 'rename-folder' });
    return requestJson(`/api/scan-archive?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ path, name }),
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async uploadFile(dir, file, fileName) {
    const params = new URLSearchParams({ action: 'upload-file' });
    const form = new FormData();
    form.append('dir', dir || '');
    form.append('fileName', fileName || '');
    form.append('file', file);
    return requestJson(`/api/scan-archive?${params.toString()}`, {
      method: 'POST',
      body: form,
    });
  },

  async deletePath(path) {
    const params = new URLSearchParams({ action: 'delete', path });
    return requestJson(`/api/scan-archive?${params.toString()}`, { method: 'DELETE' });
  },

  async deleteFile(path) {
    return this.deletePath(path);
  },
};

export default scanArchiveClient;
