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

function normalizeIdentityValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function isSameAgreementIdentity(metaA = {}, metaB = {}) {
  const aOwner = normalizeIdentityValue(metaA.ownerId || metaA.ownerLabel);
  const bOwner = normalizeIdentityValue(metaB.ownerId || metaB.ownerLabel);
  if (aOwner && bOwner && aOwner !== bOwner) return false;

  const aIndustry = normalizeIdentityValue(metaA.industryLabel);
  const bIndustry = normalizeIdentityValue(metaB.industryLabel);
  if (aIndustry && bIndustry && aIndustry !== bIndustry) return false;

  const aNoticeNo = normalizeIdentityValue(metaA.noticeNo);
  const bNoticeNo = normalizeIdentityValue(metaB.noticeNo);
  if (aNoticeNo && bNoticeNo) return aNoticeNo === bNoticeNo;

  const aTitle = normalizeIdentityValue(metaA.noticeTitle);
  const bTitle = normalizeIdentityValue(metaB.noticeTitle);
  if (aTitle && bTitle) return aTitle === bTitle;

  return false;
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
  const noticeNo = sanitizeSegment(meta.noticeNo, '');
  const title = sanitizeSegment(meta.noticeTitle, '');
  const industry = sanitizeSegment(meta.industryLabel, '');
  const identity = noticeNo || title || 'board';
  const suffix = industry ? `-${industry}` : '';
  return `company-search/agreement-board/${owner}-${range}-${identity}${suffix}.json`;
}

async function saveAgreementBoard(snapshot = {}, options = {}) {
  const token = ensureToken();
  const meta = snapshot && typeof snapshot.meta === 'object' ? snapshot.meta : {};
  const payload = snapshot && typeof snapshot.payload === 'object' ? snapshot.payload : {};
  const manifest = normalizeManifest(await readManifest());
  const existingItem = getAgreementBoardItems(manifest)
    .find((item) => item && item.meta && isSameAgreementIdentity(item.meta, meta));
  const pathname = options.pathname || meta.path || existingItem?.path || buildAgreementBoardPath(meta);
  const savedAt = meta.savedAt || new Date().toISOString();
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
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });

  const nextItems = getAgreementBoardItems(manifest)
    .filter((item) => item && item.path !== pathname)
    .filter((item) => !(item && item.meta && isSameAgreementIdentity(item.meta, document.meta)));
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
