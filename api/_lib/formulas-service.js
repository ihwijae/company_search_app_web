const formulasModule = require('../../src/shared/formulas.js');
const evaluator = require('../../src/shared/evaluator.js');
const industryAverages = require('../../src/shared/industryAverages.json');

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

async function loadMerged() {
  return loadDefaults();
}

async function loadOverrides() {
  return { version: 1, agencies: [] };
}

async function saveOverrides() {
  throw new Error('Formula overrides are disabled. Edit src/shared/formulas.defaults.json instead.');
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
    const defaults = loadDefaults();
    return evaluator.evaluateScores({ ...sanitized, formulasDoc: defaults });
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
