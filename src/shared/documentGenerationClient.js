async function request(query = '', init = {}) {
  const response = await fetch(`/api/document-generation${query}`, { credentials: 'same-origin', ...init });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || '서류 저장정보를 처리하지 못했습니다.');
  return payload.data;
}

export default {
  list: () => request(),
  load: (id) => request(`?id=${encodeURIComponent(id)}`),
  save: (payload) => request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
  remove: (id, revision) => request('', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, revision }) }),
};
