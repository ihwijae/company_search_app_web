const { put, head, get } = require('@vercel/blob');
const { parseDatasetBuffer } = require('./dataset-parser');

const DATASET_TYPES = ['eung', 'tongsin', 'sobang'];
const MANIFEST_PATH = 'company-search/datasets/manifest.json';
const datasetCache = new Map();
const MANIFEST_CACHE_TTL_MS = 30 * 1000;
let manifestCache = { value: null, storedAt: 0 };

const resolveToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN || '';

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  const response = new Response(stream);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function readJsonBlob(pathname) {
  const token = resolveToken();
  if (!token) return null;
  try {
    const result = await get(pathname, { access: 'private', token, useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const buffer = await streamToBuffer(result.stream);
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    console.warn('[blob-store] readJsonBlob failed:', pathname, error && error.message ? error.message : error);
    return null;
  }
}

async function writeJsonBlob(pathname, value) {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  return put(pathname, Buffer.from(JSON.stringify(value), 'utf8'), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });
}

async function readManifest() {
  if (manifestCache.value && (Date.now() - manifestCache.storedAt) < MANIFEST_CACHE_TTL_MS) {
    return manifestCache.value;
  }
  const manifest = await readJsonBlob(MANIFEST_PATH);
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
  await writeJsonBlob(MANIFEST_PATH, next);
  manifestCache = {
    value: next,
    storedAt: Date.now(),
  };
  return next;
}

async function storeParsedDataset(fileType, dataset, token) {
  const pathname = `company-search/datasets/${fileType}.parsed.json`;
  const uploaded = await put(pathname, Buffer.from(JSON.stringify(dataset), 'utf8'), {
    access: 'private',
    contentType: 'application/json; charset=utf-8',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });
  return {
    pathname: uploaded.pathname,
    url: uploaded.url,
    downloadUrl: uploaded.downloadUrl,
    contentType: uploaded.contentType,
  };
}

async function uploadDataset({ fileType, fileName, buffer, contentType }) {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  if (!DATASET_TYPES.includes(fileType)) throw new Error('Invalid dataset type');

  const extension = fileName && fileName.includes('.') ? fileName.split('.').pop() : 'xlsx';
  const pathname = `company-search/datasets/${fileType}.${extension || 'xlsx'}`;
  const parsedDataset = await parseDatasetBuffer(buffer, fileType, fileName || pathname);
  const uploaded = await put(pathname, buffer, {
    access: 'private',
    contentType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });
  const parsedMeta = await storeParsedDataset(fileType, parsedDataset, token);

  const manifest = await readManifest();
  manifest.datasets[fileType] = {
    fileType,
    fileName,
    pathname: uploaded.pathname,
    url: uploaded.url,
    downloadUrl: uploaded.downloadUrl,
    contentType: uploaded.contentType,
    uploadedAt: new Date().toISOString(),
    parsedPathname: parsedMeta.pathname,
    parsedUrl: parsedMeta.url,
    parsedDownloadUrl: parsedMeta.downloadUrl,
    parsedContentType: parsedMeta.contentType,
    companyCount: Array.isArray(parsedDataset.companies) ? parsedDataset.companies.length : 0,
    sheetCount: Array.isArray(parsedDataset.sheetNames) ? parsedDataset.sheetNames.length : 0,
  };
  const nextManifest = await writeManifest(manifest);
  datasetCache.set(fileType, {
    version: nextManifest.datasets[fileType]?.uploadedAt || nextManifest.updatedAt || new Date().toISOString(),
    dataset: parsedDataset,
  });
  return { uploaded, parsed: parsedMeta, manifest: nextManifest };
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
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');

  const meta = await getDatasetMeta(fileType);
  if (!meta || !meta.pathname) return null;
  const version = meta.uploadedAt || meta.parsedPathname || meta.pathname;
  const cached = datasetCache.get(fileType);
  if (cached && cached.version === version) return cached.dataset;

  if (meta.parsedPathname) {
    try {
      const parsedBlobMeta = await head(meta.parsedPathname, { token });
      const parsedCached = datasetCache.get(fileType);
      if (parsedCached && parsedCached.version === parsedBlobMeta.etag) return parsedCached.dataset;
      const parsed = await readJsonBlob(meta.parsedPathname);
      if (parsed && typeof parsed === 'object') {
        datasetCache.set(fileType, {
          version: parsedBlobMeta.etag || version,
          dataset: parsed,
        });
        return parsed;
      }
    } catch (error) {
      console.warn('[blob-store] parsed dataset lookup failed:', fileType, error && error.message ? error.message : error);
    }
  }

  try {
    const result = await get(meta.pathname, { access: 'private', token, useCache: false });
    if (!result || result.statusCode !== 200) return null;
    const buffer = await streamToBuffer(result.stream);
    const parsed = await parseDatasetBuffer(buffer, fileType, meta.fileName || meta.pathname);
    try {
      const parsedMeta = await storeParsedDataset(fileType, parsed, token);
      if (!meta.parsedPathname || meta.parsedPathname !== parsedMeta.pathname) {
        const manifest = await readManifest();
        manifest.datasets[fileType] = {
          ...(manifest.datasets[fileType] || {}),
          ...meta,
          parsedPathname: parsedMeta.pathname,
          parsedUrl: parsedMeta.url,
          parsedDownloadUrl: parsedMeta.downloadUrl,
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
    console.error('[blob-store] parseSharedDataset failed:', fileType, error);
    return null;
  }
}

function getDatasetVersion(meta) {
  if (!meta || typeof meta !== 'object') return '';
  return meta.uploadedAt || meta.parsedPathname || meta.pathname || '';
}

module.exports = {
  DATASET_TYPES,
  resolveToken,
  readManifest,
  writeManifest,
  uploadDataset,
  getDatasetMeta,
  getStatuses,
  parseSharedDataset,
  getDatasetVersion,
};
