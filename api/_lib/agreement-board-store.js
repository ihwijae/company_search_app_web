const { put, del, list, get } = require('@vercel/blob');
const { readManifest, writeManifest, resolveToken } = require('./blob-store');

const AGREEMENT_BOARD_MANIFEST_KEY = 'agreementBoardItems';
const AGREEMENT_BOARD_ROOT_LABEL = 'Vercel Blob / agreement-board';
const AGREEMENT_BOARD_PREFIX = 'company-search/agreement-board/';

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

function parseNumberLike(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/[^0-9.-]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveMetaFromPayload(payload = {}, fallback = {}) {
  const candidate = payload && typeof payload === 'object' ? payload : {};
  const estimatedAmount = parseNumberLike(
    candidate.estimatedAmount
    ?? candidate.estimatedPrice
    ?? candidate.baseAmount
    ?? fallback.estimatedAmount
  );
  return {
    ownerId: candidate.ownerId || fallback.ownerId || '',
    ownerLabel: candidate.ownerLabel || fallback.ownerLabel || '',
    rangeId: candidate.rangeId || candidate.selectedRangeKey || fallback.rangeId || '',
    rangeLabel: candidate.rangeLabel || fallback.rangeLabel || '',
    industryLabel: candidate.industryLabel || candidate.industry || fallback.industryLabel || '',
    dutyRegions: Array.isArray(candidate.dutyRegions)
      ? candidate.dutyRegions
      : (Array.isArray(fallback.dutyRegions) ? fallback.dutyRegions : []),
    estimatedAmount,
    estimatedAmountLabel: candidate.estimatedAmount || candidate.estimatedPrice || fallback.estimatedAmountLabel || '',
    noticeDate: candidate.noticeDate || fallback.noticeDate || '',
    noticeNo: candidate.noticeNo || fallback.noticeNo || '',
    noticeTitle: candidate.noticeTitle || candidate.title || fallback.noticeTitle || '',
    savedAt: candidate.savedAt || fallback.savedAt || '',
  };
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
  const rawMeta = snapshot && typeof snapshot.meta === 'object' ? snapshot.meta : {};
  const payload = snapshot && typeof snapshot.payload === 'object'
    ? snapshot.payload
    : (snapshot && typeof snapshot === 'object' ? snapshot : {});
  const meta = deriveMetaFromPayload(payload, rawMeta);
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

async function listAllAgreementBoardBlobPaths(token) {
  const pathnames = [];
  let cursor;
  do {
    const result = await list({
      prefix: AGREEMENT_BOARD_PREFIX,
      limit: 1000,
      cursor,
      token,
    });
    (result?.blobs || []).forEach((blob) => {
      if (blob?.pathname) pathnames.push(blob.pathname);
    });
    cursor = result?.cursor;
    if (!result?.hasMore) break;
  } while (cursor);
  return pathnames;
}

async function readAgreementMetaFromBlob(pathname, token) {
  const result = await get(pathname, { access: 'private', token, useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const response = new Response(result.stream);
  const arrayBuffer = await response.arrayBuffer();
  const parsed = JSON.parse(Buffer.from(arrayBuffer).toString('utf8'));
  const payload = parsed && typeof parsed === 'object'
    ? (parsed.payload && typeof parsed.payload === 'object' ? parsed.payload : parsed)
    : {};
  const rawMeta = parsed && typeof parsed === 'object' && parsed.meta && typeof parsed.meta === 'object'
    ? parsed.meta
    : {};
  return deriveMetaFromPayload(payload, rawMeta);
}

async function listAgreementBoards() {
  const manifest = normalizeManifest(await readManifest());
  const manifestItems = getAgreementBoardItems(manifest);
  const compactItems = manifestItems.filter((item) => item && item.path);
  const deduped = [];
  for (const item of compactItems) {
    const duplicateIndex = deduped.findIndex((existing) => isSameAgreementIdentity(existing?.meta || {}, item?.meta || {}));
    if (duplicateIndex >= 0) {
      const currentSavedAt = Date.parse(String(deduped[duplicateIndex]?.meta?.savedAt || '')) || 0;
      const nextSavedAt = Date.parse(String(item?.meta?.savedAt || '')) || 0;
      if (nextSavedAt >= currentSavedAt) {
        deduped[duplicateIndex] = item;
      }
      continue;
    }
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    const aTs = Date.parse(String(a?.meta?.savedAt || a?.meta?.noticeDate || '')) || 0;
    const bTs = Date.parse(String(b?.meta?.savedAt || b?.meta?.noticeDate || '')) || 0;
    return bTs - aTs;
  });

  return deduped;
}

async function loadAgreementBoard(pathname) {
  const token = ensureToken();
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
