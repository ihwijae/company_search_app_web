const { put, del } = require('@vercel/blob');
const { readManifest, writeManifest, resolveToken } = require('./blob-store');

const AGREEMENT_BOARD_MANIFEST_KEY = 'agreementBoardItems';
const AGREEMENT_BOARD_ROOT_LABEL = 'Vercel Blob / agreement-board';

function ensureToken() {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  return token;
}

function sanitizeSegment(value, fallback = 'agreement') {
  const normalized = String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^0-9A-Za-z가-힣_-]/g, '')
    .slice(0, 48);
  return normalized || fallback;
}

function normalizeManifest(manifest) {
  const base = manifest && typeof manifest === 'object' ? manifest : { updatedAt: null, datasets: {} };
  const items = Array.isArray(base[AGREEMENT_BOARD_MANIFEST_KEY]) ? base[AGREEMENT_BOARD_MANIFEST_KEY] : [];
  return { ...base, [AGREEMENT_BOARD_MANIFEST_KEY]: items };
}

function getAgreementBoardItems(manifest) {
  return normalizeManifest(manifest)[AGREEMENT_BOARD_MANIFEST_KEY];
}

function buildAgreementBoardPath(meta = {}) {
  const owner = sanitizeSegment(meta.ownerId || meta.ownerLabel, 'owner');
  const range = sanitizeSegment(meta.rangeId || meta.rangeLabel, 'range');
  const noticeNo = sanitizeSegment(meta.noticeNo, 'notice');
  const title = sanitizeSegment(meta.noticeTitle, 'board');
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `company-search/agreement-board/${owner}-${range}-${noticeNo}-${title}-${stamp}.json`;
}

async function saveAgreementBoard(snapshot = {}) {
  const token = ensureToken();
  const meta = snapshot && typeof snapshot.meta === 'object' ? snapshot.meta : {};
  const payload = snapshot && typeof snapshot.payload === 'object' ? snapshot.payload : {};
  const pathname = buildAgreementBoardPath(meta);
  const savedAt = new Date().toISOString();
  const document = {
    meta: {
      ...meta,
      savedAt,
    },
    payload,
  };

  await put(pathname, Buffer.from(JSON.stringify(document), 'utf8'), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: false,
    addRandomSuffix: false,
    token,
  });

  const manifest = normalizeManifest(await readManifest());
  const nextItems = getAgreementBoardItems(manifest)
    .filter((item) => item && item.path !== pathname);
  nextItems.unshift({
    path: pathname,
    meta: document.meta,
  });
  manifest[AGREEMENT_BOARD_MANIFEST_KEY] = nextItems;
  await writeManifest(manifest);
  return { path: pathname, meta: document.meta };
}

async function listAgreementBoards() {
  const manifest = normalizeManifest(await readManifest());
  return getAgreementBoardItems(manifest);
}

async function loadAgreementBoard(pathname) {
  const token = ensureToken();
  const { get } = require('@vercel/blob');
  const result = await get(pathname, { access: 'private', token, useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new Error('협정을 불러오지 못했습니다.');
  }
  const response = new Response(result.stream);
  const arrayBuffer = await response.arrayBuffer();
  const parsed = JSON.parse(Buffer.from(arrayBuffer).toString('utf8'));
  return parsed && parsed.payload ? parsed.payload : {};
}

async function deleteAgreementBoard(pathname) {
  const token = ensureToken();
  await del(pathname, { token });
  const manifest = normalizeManifest(await readManifest());
  manifest[AGREEMENT_BOARD_MANIFEST_KEY] = getAgreementBoardItems(manifest)
    .filter((item) => item && item.path !== pathname);
  await writeManifest(manifest);
}

module.exports = {
  AGREEMENT_BOARD_ROOT_LABEL,
  saveAgreementBoard,
  listAgreementBoards,
  loadAgreementBoard,
  deleteAgreementBoard,
};
