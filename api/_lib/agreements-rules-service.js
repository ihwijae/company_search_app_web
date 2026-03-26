const schema = require('../../src/shared/agreements/rules/schema.js');
const { AGREEMENTS_RULES_PATH, readConfigJson, writeConfigJson } = require('./config-store');

async function loadRules() {
  const fallback = schema.defaultRules();
  const rules = await readConfigJson(AGREEMENTS_RULES_PATH, fallback);
  if (!rules || typeof rules !== 'object') return fallback;
  return rules;
}

async function saveRules(payload = {}) {
  const validation = schema.validateRules(payload);
  if (!validation.ok) {
    return { success: false, message: validation.errors.join(' / ') };
  }
  await writeConfigJson(AGREEMENTS_RULES_PATH, payload);
  return { success: true };
}

module.exports = {
  loadRules,
  saveRules,
};

