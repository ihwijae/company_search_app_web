// Shared loader for evaluation formulas: defaults only
// CommonJS to be usable from Electron main and renderer (via bundler)

const defaults = require('./formulas.defaults.json');

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function loadFormulasMerged() {
  return deepClone(defaults);
}

function loadFormulasDefaults() {
  return deepClone(defaults);
}

module.exports = {
  loadFormulasMerged,
  loadFormulasDefaults,
};
