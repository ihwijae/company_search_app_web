async function request(init = {}) {
  const response = await fetch('/api/major-materials', { credentials: 'same-origin', ...init });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || '주요자재 설정을 처리하지 못했습니다.');
  return payload.data;
}

export default {
  load: () => request(),
  save: (items, revision) => request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, revision }) }),
};
