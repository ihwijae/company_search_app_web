async function request(init) {
  const response = await fetch('/api/fixed-companies', { credentials: 'same-origin', ...init });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || '고정업체 설정을 처리하지 못했습니다.');
  return payload.data;
}

export default {
  load: () => request(),
  saveGroup: (scope, companies, revision) => request({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, companies, revision }),
  }),
  saveOwnCorporations: (industry, companies, revision) => request({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'own-corporations', industry, companies, revision }),
  }),
};
