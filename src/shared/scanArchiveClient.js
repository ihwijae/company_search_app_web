async function requestJson(url) {
  const response = await fetch(url);
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
};

export default scanArchiveClient;
