#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { list, get, del } = require('@vercel/blob');
const { readManifest, writeManifest, resolveToken } = require('../api/_lib/blob-store');

const AGREEMENT_PREFIX = 'company-search/agreement-board/';
const MANIFEST_KEY = 'agreementBoardItems';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) return;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key]) return;
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function parseMetaFromDocument(raw = {}, fallbackUploadedAt = null, pathname = '') {
  const payload = raw && typeof raw.payload === 'object' ? raw.payload : (raw && typeof raw === 'object' ? raw : {});
  const meta = raw && typeof raw.meta === 'object' ? raw.meta : {};

  const owner = normalizeText(payload.ownerId || meta.ownerId || payload.ownerLabel || meta.ownerLabel);
  const industry = normalizeText(payload.industryLabel || payload.industry || meta.industryLabel);
  const noticeNo = normalizeText(payload.noticeNo || meta.noticeNo);
  const title = normalizeText(payload.noticeTitle || payload.title || meta.noticeTitle);
  const idCore = noticeNo || title || normalizeText(pathname);
  const identity = `${owner}|${industry}|${idCore}`;

  const ts = Date.parse(String(meta.savedAt || payload.savedAt || meta.noticeDate || payload.noticeDate || ''));
  const uploadedTs = fallbackUploadedAt instanceof Date ? fallbackUploadedAt.getTime() : 0;
  const sortTs = Number.isFinite(ts) ? ts : uploadedTs;

  return {
    identity,
    sortTs: Number.isFinite(sortTs) ? sortTs : 0,
    display: {
      owner: payload.ownerId || meta.ownerId || payload.ownerLabel || meta.ownerLabel || '',
      industry: payload.industryLabel || payload.industry || meta.industryLabel || '',
      noticeNo: payload.noticeNo || meta.noticeNo || '',
      title: payload.noticeTitle || payload.title || meta.noticeTitle || '',
      savedAt: meta.savedAt || payload.savedAt || '',
    },
  };
}

async function readBlobJson(pathname, token) {
  const result = await get(pathname, { access: 'private', token, useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const response = new Response(result.stream);
  const arrayBuffer = await response.arrayBuffer();
  return JSON.parse(Buffer.from(arrayBuffer).toString('utf8'));
}

async function listAllAgreementBlobs(token) {
  const blobs = [];
  let cursor = undefined;
  do {
    const response = await list({
      prefix: AGREEMENT_PREFIX,
      limit: 1000,
      cursor,
      token,
    });
    blobs.push(...(response?.blobs || []));
    cursor = response?.cursor;
    if (!response?.hasMore) break;
  } while (cursor);
  return blobs;
}

async function removeFromManifest(pathsToDeleteSet) {
  const manifest = await readManifest();
  if (!manifest || typeof manifest !== 'object') return;
  const items = Array.isArray(manifest[MANIFEST_KEY]) ? manifest[MANIFEST_KEY] : [];
  const nextItems = items.filter((item) => !pathsToDeleteSet.has(item?.path));
  if (nextItems.length !== items.length) {
    manifest[MANIFEST_KEY] = nextItems;
    await writeManifest(manifest);
  }
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));

  const apply = process.argv.includes('--apply');
  const token = resolveToken();
  if (!token) {
    throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  }

  const blobs = await listAllAgreementBlobs(token);
  if (blobs.length === 0) {
    console.log('협정 Blob 파일이 없습니다.');
    return;
  }

  console.log(`Found ${blobs.length} agreement-board blobs.`);
  const groups = new Map();
  const allItems = [];

  for (const blob of blobs) {
    try {
      const pathname = blob?.pathname;
      if (!pathname) continue;
      const json = await readBlobJson(pathname, token);
      const meta = parseMetaFromDocument(json || {}, blob?.uploadedAt || null, pathname);
      const item = {
        pathname,
        sortTs: meta.sortTs,
        identity: meta.identity,
        display: meta.display,
      };
      allItems.push(item);
      if (!groups.has(item.identity)) groups.set(item.identity, []);
      groups.get(item.identity).push(item);
    } catch (error) {
      console.warn(`Skip unreadable blob: ${blob?.pathname || '(unknown)'}`);
      console.warn(error && error.message ? error.message : error);
    }
  }

  const toDelete = [];
  let duplicateGroups = 0;
  groups.forEach((items) => {
    if (!Array.isArray(items) || items.length <= 1) return;
    duplicateGroups += 1;
    items.sort((a, b) => b.sortTs - a.sortTs);
    toDelete.push(...items.slice(1));
  });

  if (toDelete.length === 0) {
    console.log('중복 협정 파일이 없습니다.');
    return;
  }

  console.log(`Duplicate groups: ${duplicateGroups}`);
  console.log(`Delete targets: ${toDelete.length}`);
  toDelete.slice(0, 30).forEach((item, index) => {
    const d = item.display || {};
    console.log(
      `[${index + 1}] ${item.pathname} | ${d.owner || '-'} | ${d.industry || '-'} | ${d.noticeNo || '-'} | ${d.title || '-'}`
    );
  });
  if (toDelete.length > 30) {
    console.log(`... and ${toDelete.length - 30} more`);
  }

  if (!apply) {
    console.log('Dry-run only. 실제 삭제하려면 --apply 옵션으로 다시 실행하세요.');
    return;
  }

  let deleted = 0;
  for (const item of toDelete) {
    try {
      await del(item.pathname, { token });
      deleted += 1;
      console.log(`Deleted: ${item.pathname}`);
    } catch (error) {
      console.error(`Failed to delete: ${item.pathname}`);
      console.error(error && error.message ? error.message : error);
    }
  }

  const deletedSet = new Set(toDelete.map((item) => item.pathname));
  await removeFromManifest(deletedSet);
  console.log(`Done. Deleted ${deleted}/${toDelete.length} duplicate blobs.`);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});

