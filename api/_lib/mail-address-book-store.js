const { readConfigJson, writeConfigJson } = require('./config-store');

const MAIL_ADDRESS_BOOK_PATH = 'company-search/config/mail.address-book.json';

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
  return normalizeList(stored);
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
