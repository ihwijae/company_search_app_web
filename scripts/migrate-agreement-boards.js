#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { saveAgreementBoard } = require('../api/_lib/agreement-board-store');

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
  const meta = raw && typeof raw.meta === 'object' ? raw.meta : {};
  const payload = raw && typeof raw.payload === 'object' ? raw.payload : {};
  return { meta, payload };
}

async function main() {
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
