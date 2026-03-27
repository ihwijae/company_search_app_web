import industryAverages from './industryAverages.json';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const resolveEvaluateScores = (evaluatorModule) => {
  if (typeof evaluatorModule === 'function') return evaluatorModule;
  if (typeof evaluatorModule?.evaluateScores === 'function') return evaluatorModule.evaluateScores;
  if (typeof evaluatorModule?.default?.evaluateScores === 'function') return evaluatorModule.default.evaluateScores;
  return null;
};

const normalizeFileType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === '전기') return 'eung';
  if (normalized === '통신') return 'tongsin';
  if (normalized === '소방') return 'sobang';
  return normalized;
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

async function fetchJson(url, init = {}) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

const formulasClient = {
  async load() {
    return fetchJson('/api/formulas?action=load');
  },

  async loadDefaults() {
    return fetchJson('/api/formulas?action=defaults');
  },

  async loadOverrides() {
    return fetchJson('/api/formulas?action=load-overrides');
  },

  async saveOverrides(payload = {}) {
    return fetchJson('/api/formulas', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ action: 'save-overrides', payload: payload || {} }),
    });
  },

  async evaluate(payload = {}, { useDefaultsOnly = false } = {}) {
    const evaluatorModule = await import('./evaluator.js');
    const evaluateScores = resolveEvaluateScores(evaluatorModule);
    if (typeof evaluateScores !== 'function') {
      throw new Error('Local formulas evaluator is not available');
    }

    const sanitized = payload && typeof payload === 'object' ? deepClone(payload) : {};
    if (!sanitized.industryAvg) {
      const key = normalizeFileType(sanitized.fileType || sanitized?.inputs?.fileType);
      if (key) {
        const avg = industryAverages[key] || null;
        if (avg) sanitized.industryAvg = avg;
      }
    }

    const data = evaluateScores({
      ...sanitized,
      useDefaultsOnly,
    });

    return { success: true, data };
  },
};

export default formulasClient;
