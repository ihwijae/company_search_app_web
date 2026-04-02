const fs = require('fs');
const path = require('path');
const { ROOTS } = require('./local-storage');
const { readConfigJson, writeConfigJson } = require('./config-store');

const MAIL_ADDRESS_BOOK_PATH = path.join(ROOTS.config, 'mail.address-book.json');
const LEGACY_MAIL_ADDRESS_BOOK_PATH = path.join(process.cwd(), 'company-search', 'config', 'mail.address-book.json');

function normalizeEntry(entry, index) {
  if (!entry || typeof entry !== 'object') return null;
  const id = Number(entry.id);
  return {
    id: Number.isFinite(id) && id > 0 ? id : index + 1,
    vendorName: typeof entry.vendorName === 'string' ? entry.vendorName : '',
    contactName: typeof entry.contactName === 'string' ? entry.contactName : '',
    email: typeof entry.email === 'string' ? entry.email : '',
  };
}

function normalizeList(list = []) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  let nextId = 1;
  return list
    .map((entry, index) => normalizeEntry(entry, index))
    .filter(Boolean)
    .map((entry) => {
      let id = Number(entry.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
        while (seen.has(nextId)) nextId += 1;
        id = nextId;
        nextId += 1;
      }
      seen.add(id);
      return { ...entry, id };
    });
}

async function loadMailAddressBook(fallback = []) {
  const stored = await readConfigJson(MAIL_ADDRESS_BOOK_PATH, fallback);
  const normalized = normalizeList(stored);
  if (normalized.length > 0) return normalized;

  try {
    const hasLegacy = await fs.promises
      .stat(LEGACY_MAIL_ADDRESS_BOOK_PATH)
      .then((stat) => stat && stat.isFile())
      .catch(() => false);
    if (!hasLegacy) return normalized;

    const legacyRaw = await fs.promises.readFile(LEGACY_MAIL_ADDRESS_BOOK_PATH, 'utf8');
    const legacyParsed = JSON.parse(legacyRaw);
    const legacyNormalized = normalizeList(legacyParsed);
    if (legacyNormalized.length === 0) return normalized;
    await writeConfigJson(MAIL_ADDRESS_BOOK_PATH, legacyNormalized);
    return legacyNormalized;
  } catch (error) {
    console.warn('[mail-address-book-store] legacy migration failed:', error && error.message ? error.message : error);
    return normalized;
  }
}

async function saveMailAddressBook(list = []) {
  const normalized = normalizeList(list);
  await writeConfigJson(MAIL_ADDRESS_BOOK_PATH, normalized);
  return normalized;
}

module.exports = {
  MAIL_ADDRESS_BOOK_PATH,
  loadMailAddressBook,
  saveMailAddressBook,
};
