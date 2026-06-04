const path = require('path');
const { ROOTS, ensureDir, readJsonFile, writeJsonFile } = require('./local-storage');

const FORMULAS_OVERRIDES_PATH = path.join(ROOTS.config, 'formulas.overrides.json');
const AGREEMENTS_RULES_PATH = path.join(ROOTS.config, 'agreements.rules.json');
const LH_AWARD_HISTORY_PATH = path.join(ROOTS.config, 'lh.award-history.json');

async function readConfigJson(pathname, fallback = null) {
  try {
    await ensureDir(ROOTS.config);
    return await readJsonFile(pathname, fallback);
  } catch (error) {
    console.warn('[config-store] read failed:', pathname, error && error.message ? error.message : error);
    return fallback;
  }
}

async function writeConfigJson(pathname, value) {
  await ensureDir(ROOTS.config);
  await writeJsonFile(pathname, value);
}

module.exports = {
  FORMULAS_OVERRIDES_PATH,
  AGREEMENTS_RULES_PATH,
  LH_AWARD_HISTORY_PATH,
  readConfigJson,
  writeConfigJson,
};
