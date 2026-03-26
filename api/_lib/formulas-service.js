const formulasModule = require('../../src/shared/formulas.js');
const evaluator = require('../../src/shared/evaluator.js');
const industryAverages = require('../../src/shared/industryAverages.json');
const { FORMULAS_OVERRIDES_PATH, readConfigJson, writeConfigJson } = require('./config-store');

function normalizeFileType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === '전기') return 'eung';
  if (normalized === '통신') return 'tongsin';
  if (normalized === '소방') return 'sobang';
  return normalized;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadDefaults() {
  return formulasModule.loadFormulasDefaults();
}

async function loadOverrides() {
  const overrides = await readConfigJson(FORMULAS_OVERRIDES_PATH, { version: 1, agencies: [] });
  if (!overrides || typeof overrides !== 'object') return { version: 1, agencies: [] };
  return {
    version: Number(overrides.version) || 1,
    agencies: Array.isArray(overrides.agencies) ? overrides.agencies : [],
  };
}

async function loadMerged() {
  const defaults = loadDefaults();
  const overrides = await loadOverrides();
  const mergedAgencies = formulasModule._internals.mergeAgencies(
    Array.isArray(defaults.agencies) ? defaults.agencies : [],
    Array.isArray(overrides.agencies) ? overrides.agencies : []
  );
  return {
    ...defaults,
    agencies: mergedAgencies,
  };
}

async function saveOverrides(payload = {}) {
  const incoming = payload && payload.agencies ? payload : { agencies: [] };
  const base = await loadOverrides();
  const mergedAgencies = formulasModule._internals.mergeAgencies(base.agencies, incoming.agencies);
  const next = {
    version: Math.max(base.version || 1, Number(incoming.version) || 1),
    agencies: mergedAgencies,
  };
  await writeConfigJson(FORMULAS_OVERRIDES_PATH, next);
  return next;
}

async function evaluate(payload = {}, { useDefaultsOnly = false } = {}) {
  const sanitized = payload && typeof payload === 'object' ? deepClone(payload) : {};
  if (!sanitized.industryAvg) {
    const key = normalizeFileType(sanitized.fileType || sanitized?.inputs?.fileType);
    if (key) {
      const avg = industryAverages[key] || null;
      if (avg) sanitized.industryAvg = avg;
    }
  }

  if (!useDefaultsOnly) {
    const merged = await loadMerged();
    return evaluator.evaluateScores({ ...sanitized, formulasDoc: merged });
  }

  return evaluator.evaluateScores({ ...sanitized, useDefaultsOnly: true });
}

module.exports = {
  loadDefaults,
  loadOverrides,
  loadMerged,
  saveOverrides,
  evaluate,
};
