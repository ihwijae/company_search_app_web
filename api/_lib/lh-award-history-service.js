const path = require('path');
const { pathToFileURL } = require('url');
const { LH_AWARD_HISTORY_PATH, readConfigJson, writeConfigJson } = require('./config-store');

let sharedModulePromise = null;

async function loadSharedModule() {
  if (!sharedModulePromise) {
    const modulePath = path.join(__dirname, '../../src/shared/agreements/lhAwardHistory.js');
    sharedModulePromise = import(pathToFileURL(modulePath).href);
  }
  return sharedModulePromise;
}

async function loadLhAwardHistory() {
  const {
    DEFAULT_LH_AWARD_HISTORY_ENTRIES,
    normalizeLhAwardHistoryEntries,
  } = await loadSharedModule();
  const fallback = { entries: DEFAULT_LH_AWARD_HISTORY_ENTRIES };
  const doc = await readConfigJson(LH_AWARD_HISTORY_PATH, fallback);
  const entries = normalizeLhAwardHistoryEntries(doc?.entries || fallback.entries);
  return { entries };
}

async function saveLhAwardHistory(payload = {}) {
  const { normalizeLhAwardHistoryEntries } = await loadSharedModule();
  const entries = normalizeLhAwardHistoryEntries(payload?.entries || []);
  await writeConfigJson(LH_AWARD_HISTORY_PATH, { entries });
  return { success: true, entries };
}

module.exports = {
  loadLhAwardHistory,
  saveLhAwardHistory,
};
