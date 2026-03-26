#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { saveAgreementBoard } = require('../api/_lib/agreement-board-store');

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

function listJsonFiles(rootDir) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const files = [];
  entries.forEach((entry) => {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
      return;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(fullPath);
    }
  });
  return files;
}

function loadAgreementSnapshot(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const hasMeta = raw && typeof raw.meta === 'object';
  const hasPayload = raw && typeof raw.payload === 'object';
  const payload = hasPayload ? raw.payload : (raw && typeof raw === 'object' ? raw : {});
  const metaBase = hasMeta ? raw.meta : {};
  const meta = {
    ownerId: payload.ownerId || metaBase.ownerId || '',
    ownerLabel: payload.ownerLabel || metaBase.ownerLabel || '',
    rangeId: payload.rangeId || payload.selectedRangeKey || metaBase.rangeId || '',
    rangeLabel: payload.rangeLabel || metaBase.rangeLabel || '',
    industryLabel: payload.industryLabel || payload.industry || metaBase.industryLabel || '',
    dutyRegions: Array.isArray(payload.dutyRegions)
      ? payload.dutyRegions
      : (Array.isArray(metaBase.dutyRegions) ? metaBase.dutyRegions : []),
    estimatedAmount: payload.estimatedAmount || payload.estimatedPrice || payload.baseAmount || metaBase.estimatedAmount || '',
    estimatedAmountLabel: payload.estimatedAmount || payload.estimatedPrice || metaBase.estimatedAmountLabel || '',
    noticeDate: payload.noticeDate || metaBase.noticeDate || '',
    noticeNo: payload.noticeNo || metaBase.noticeNo || '',
    noticeTitle: payload.noticeTitle || payload.title || metaBase.noticeTitle || '',
    savedAt: metaBase.savedAt || '',
    sourcePath: filePath,
  };
  return { meta, payload };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));
  loadEnvFile(path.resolve(process.cwd(), '.env'));

  const sourceDir = process.argv[2];
  if (!sourceDir) {
    throw new Error('Usage: node scripts/migrate-agreement-boards.js <source-directory>');
  }

  const resolvedSource = path.resolve(process.cwd(), sourceDir);
  if (!fs.existsSync(resolvedSource) || !fs.statSync(resolvedSource).isDirectory()) {
    throw new Error(`Directory not found: ${resolvedSource}`);
  }

  const files = listJsonFiles(resolvedSource);
  if (files.length === 0) {
    console.log('No JSON files found.');
    return;
  }

  console.log(`Found ${files.length} agreement files.`);
  let imported = 0;

  for (const filePath of files) {
    try {
      const snapshot = loadAgreementSnapshot(filePath);
      await saveAgreementBoard(snapshot);
      imported += 1;
      console.log(`Imported: ${filePath}`);
    } catch (error) {
      console.error(`Failed: ${filePath}`);
      console.error(error && error.message ? error.message : error);
    }
  }

  console.log(`Done. Imported ${imported}/${files.length} files.`);
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
