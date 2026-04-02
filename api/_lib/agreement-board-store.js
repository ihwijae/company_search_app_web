const fs = require('fs');
const path = require('path');
const { ROOTS, ensureDir, readJsonFile, writeJsonFile, sanitizeFileName, resolveWithinRoot } = require('./local-storage');

const AGREEMENT_BOARD_MANIFEST_KEY = 'agreementBoardItems';
const AGREEMENT_BOARD_ROOT_LABEL = 'Local File / agreement-board';
const AGREEMENT_BOARD_MANIFEST_PATH = path.join(ROOTS.agreementBoards, 'manifest.json');

function sanitizeSegment(value, fallback = 'agreement') {
  return sanitizeFileName(String(value || '').trim().replace(/\s+/g, '-').slice(0, 48), fallback);
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
  return `${owner}-${range}-${identity}${suffix}.json`;
}

async function readAgreementManifest() {
  await ensureDir(ROOTS.agreementBoards);
  const manifest = await readJsonFile(AGREEMENT_BOARD_MANIFEST_PATH, { updatedAt: null, agreementBoardItems: [] });
  return normalizeManifest(manifest);
}

async function writeAgreementManifest(manifest) {
  const next = {
    ...normalizeManifest(manifest),
    updatedAt: new Date().toISOString(),
  };
  await ensureDir(ROOTS.agreementBoards);
  await writeJsonFile(AGREEMENT_BOARD_MANIFEST_PATH, next);
  return next;
}

async function saveAgreementBoard(snapshot = {}, options = {}) {
  const rawMeta = snapshot && typeof snapshot.meta === 'object' ? snapshot.meta : {};
  const payload = snapshot && typeof snapshot.payload === 'object'
    ? snapshot.payload
    : (snapshot && typeof snapshot === 'object' ? snapshot : {});
  const meta = deriveMetaFromPayload(payload, rawMeta);
  const manifest = await readAgreementManifest();
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

  const filePath = resolveWithinRoot(ROOTS.agreementBoards, pathname);
  await writeJsonFile(filePath, document);

  const nextItems = getAgreementBoardItems(manifest)
    .filter((item) => item && item.path !== pathname)
    .filter((item) => !(item && item.meta && isSameAgreementIdentity(item.meta, document.meta)));
  nextItems.unshift({
    path: pathname,
    meta: document.meta,
  });
  manifest[AGREEMENT_BOARD_MANIFEST_KEY] = nextItems;
  await writeAgreementManifest(manifest);
  return { path: pathname, meta: document.meta };
}

async function listAgreementBoards() {
  const manifest = await readAgreementManifest();
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
  const filePath = resolveWithinRoot(ROOTS.agreementBoards, pathname);
  const parsed = await readJsonFile(filePath, null);
  if (!parsed) {
    throw new Error('협정을 불러오지 못했습니다.');
  }
  return parsed && parsed.payload ? parsed.payload : {};
}

async function deleteAgreementBoard(pathname) {
  const filePath = resolveWithinRoot(ROOTS.agreementBoards, pathname);
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (!error || error.code !== 'ENOENT') throw error;
  }
  const manifest = await readAgreementManifest();
  manifest[AGREEMENT_BOARD_MANIFEST_KEY] = getAgreementBoardItems(manifest)
    .filter((item) => item && item.path !== pathname);
  await writeAgreementManifest(manifest);
}

module.exports = {
  AGREEMENT_BOARD_ROOT_LABEL,
  saveAgreementBoard,
  listAgreementBoards,
  loadAgreementBoard,
  deleteAgreementBoard,
};
