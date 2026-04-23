const fs = require('fs');
const path = require('path');
const { parseDatasetBuffer } = require('./dataset-parser');
const { ROOTS, ensureDir, readJsonFile, writeJsonFile } = require('./local-storage');

const DATASET_TYPES = ['eung', 'tongsin', 'sobang'];
const DEFAULT_DATASET_ROOT = ROOTS.datasets;
const MANIFEST_PATH = 'manifest.json';
const datasetCache = new Map();
let manifestCache = { value: null, storedAt: 0 };

const resolveDatasetRoot = () => {
  const configured = String(process.env.DATASET_UPLOAD_DIR || process.env.COMPANY_SEARCH_DATASET_DIR || '').trim();
  return configured || DEFAULT_DATASET_ROOT;
};

const ensureDatasetRoot = async () => ensureDir(resolveDatasetRoot());

const toPosixRelative = (targetPath) => path.relative(resolveDatasetRoot(), targetPath).split(path.sep).join('/');

const toAbsolutePath = (relativePath) => {
  if (!relativePath) return '';
  return path.join(resolveDatasetRoot(), relativePath);
};

async function readManifest() {
  if (manifestCache.value) {
    return manifestCache.value;
  }
  const manifestPath = path.join(await ensureDatasetRoot(), MANIFEST_PATH);
  const manifest = await readJsonFile(manifestPath, null);
  const resolved = manifest && typeof manifest === 'object' ? manifest : {
    updatedAt: null,
    datasets: {},
  };
  manifestCache = {
    value: resolved,
    storedAt: Date.now(),
  };
  return resolved;
}

async function writeManifest(manifest) {
  const next = {
    ...(manifest && typeof manifest === 'object' ? manifest : {}),
    updatedAt: new Date().toISOString(),
    datasets: (manifest && manifest.datasets) || {},
  };
  const manifestPath = path.join(await ensureDatasetRoot(), MANIFEST_PATH);
  await writeJsonFile(manifestPath, next);
  manifestCache = {
    value: next,
    storedAt: Date.now(),
  };
  return next;
}

async function storeParsedDataset(fileType, dataset) {
  const root = await ensureDatasetRoot();
  const relativePath = `${fileType}.parsed.json`;
  const filePath = path.join(root, relativePath);
  await writeJsonFile(filePath, dataset);
  return {
    pathname: relativePath,
    filePath,
    contentType: 'application/json; charset=utf-8',
  };
}

async function uploadDataset({ fileType, fileName, buffer, contentType }) {
  if (!DATASET_TYPES.includes(fileType)) throw new Error('Invalid dataset type');

  const root = await ensureDatasetRoot();
  const extname = path.extname(fileName || '').toLowerCase() || '.xlsx';
  const originalFileName = `${fileType}${extname}`;
  const originalPath = path.join(root, originalFileName);
  const parsedDataset = await parseDatasetBuffer(buffer, fileType, fileName || originalFileName);
  await fs.promises.writeFile(originalPath, buffer);
  const parsedMeta = await storeParsedDataset(fileType, {
    ...parsedDataset,
    updatedAt: new Date().toISOString(),
  });

  const manifest = await readManifest();
  const uploadedAt = new Date().toISOString();
  manifest.datasets[fileType] = {
    fileType,
    fileName,
    pathname: toPosixRelative(originalPath),
    filePath: originalPath,
    contentType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt,
    parsedPathname: parsedMeta.pathname,
    parsedFilePath: parsedMeta.filePath,
    parsedContentType: parsedMeta.contentType,
    companyCount: Array.isArray(parsedDataset.companies) ? parsedDataset.companies.length : 0,
    sheetCount: Array.isArray(parsedDataset.sheetNames) ? parsedDataset.sheetNames.length : 0,
  };
  const nextManifest = await writeManifest(manifest);
  datasetCache.set(fileType, {
    version: nextManifest.datasets[fileType]?.uploadedAt || nextManifest.updatedAt || new Date().toISOString(),
    dataset: {
      ...parsedDataset,
      updatedAt: uploadedAt,
    },
  });
  return {
    uploaded: {
      pathname: toPosixRelative(originalPath),
      filePath: originalPath,
      contentType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    parsed: parsedMeta,
    manifest: nextManifest,
  };
}

async function refreshDataset(fileType) {
  if (!DATASET_TYPES.includes(fileType)) throw new Error('Invalid dataset type');

  const manifest = await readManifest();
  const current = manifest.datasets && manifest.datasets[fileType] ? manifest.datasets[fileType] : null;
  if (!current || !current.pathname) {
    throw new Error(`${fileType} dataset is not available`);
  }

  const sourcePath = toAbsolutePath(current.pathname);
  const buffer = await fs.promises.readFile(sourcePath);
  const parsedDataset = await parseDatasetBuffer(buffer, fileType, current.fileName || path.basename(sourcePath));
  const parsedMeta = await storeParsedDataset(fileType, {
    ...parsedDataset,
    updatedAt: new Date().toISOString(),
  });

  const refreshedAt = new Date().toISOString();
  manifest.datasets[fileType] = {
    ...current,
    parsedPathname: parsedMeta.pathname,
    parsedFilePath: parsedMeta.filePath,
    parsedContentType: parsedMeta.contentType,
    companyCount: Array.isArray(parsedDataset.companies) ? parsedDataset.companies.length : 0,
    sheetCount: Array.isArray(parsedDataset.sheetNames) ? parsedDataset.sheetNames.length : 0,
    uploadedAt: refreshedAt,
    refreshedAt,
  };
  const nextManifest = await writeManifest(manifest);
  datasetCache.set(fileType, {
    version: getDatasetVersion(nextManifest.datasets[fileType]),
    dataset: {
      ...parsedDataset,
      updatedAt: refreshedAt,
    },
  });

  return {
    fileType,
    refreshedAt,
    companyCount: manifest.datasets[fileType].companyCount || 0,
    sheetCount: manifest.datasets[fileType].sheetCount || 0,
    manifest: nextManifest,
  };
}

async function getDatasetMeta(fileType) {
  const manifest = await readManifest();
  return manifest.datasets && manifest.datasets[fileType] ? manifest.datasets[fileType] : null;
}

async function getStatuses() {
  const manifest = await readManifest();
  return DATASET_TYPES.reduce((acc, type) => {
    acc[type] = Boolean(manifest.datasets && manifest.datasets[type]);
    return acc;
  }, {});
}

async function parseSharedDataset(fileType) {
  if (!DATASET_TYPES.includes(fileType)) throw new Error('Invalid dataset type');

  const meta = await getDatasetMeta(fileType);
  if (!meta || !meta.pathname) return null;
  const version = meta.uploadedAt || meta.parsedPathname || meta.pathname;
  const cached = datasetCache.get(fileType);
  if (cached && cached.version === version) return cached.dataset;

  if (meta.parsedPathname) {
    try {
      const parsed = await readJsonFile(toAbsolutePath(meta.parsedPathname));
      if (parsed && typeof parsed === 'object') {
        datasetCache.set(fileType, {
          version,
          dataset: parsed,
        });
        return parsed;
      }
    } catch (error) {
      console.warn('[dataset-store] parsed dataset lookup failed:', fileType, error && error.message ? error.message : error);
    }
  }

  try {
    const buffer = await fs.promises.readFile(toAbsolutePath(meta.pathname));
    const parsed = await parseDatasetBuffer(buffer, fileType, meta.fileName || meta.pathname);
    try {
      const parsedMeta = await storeParsedDataset(fileType, parsed);
      if (!meta.parsedPathname || meta.parsedPathname !== parsedMeta.pathname) {
        const manifest = await readManifest();
        manifest.datasets[fileType] = {
          ...(manifest.datasets[fileType] || {}),
          ...meta,
          parsedPathname: parsedMeta.pathname,
          parsedFilePath: parsedMeta.filePath,
          parsedContentType: parsedMeta.contentType,
          companyCount: Array.isArray(parsed.companies) ? parsed.companies.length : 0,
          sheetCount: Array.isArray(parsed.sheetNames) ? parsed.sheetNames.length : 0,
        };
        await writeManifest(manifest);
      }
    } catch (persistError) {
      console.warn('[blob-store] failed to persist parsed dataset:', fileType, persistError && persistError.message ? persistError.message : persistError);
    }
    datasetCache.set(fileType, { version, dataset: parsed });
    return parsed;
  } catch (error) {
    console.error('[dataset-store] parseSharedDataset failed:', fileType, error);
    return null;
  }
}

function getDatasetVersion(meta) {
  if (!meta || typeof meta !== 'object') return '';
  return meta.uploadedAt || meta.parsedPathname || meta.pathname || '';
}

module.exports = {
  DATASET_TYPES,
  resolveToken: () => resolveDatasetRoot(),
  resolveDatasetRoot,
  readManifest,
  writeManifest,
  uploadDataset,
  refreshDataset,
  getDatasetMeta,
  getStatuses,
  parseSharedDataset,
  getDatasetVersion,
};
