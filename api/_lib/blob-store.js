const { put, head, get } = require('@vercel/blob');
const { parseDatasetBuffer } = require('./dataset-parser');

const DATASET_TYPES = ['eung', 'tongsin', 'sobang'];
const MANIFEST_PATH = 'company-search/datasets/manifest.json';
const cache = new Map();

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
  const result = await get(pathname, { access: 'private', token, useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const buffer = await streamToBuffer(result.stream);
  return JSON.parse(buffer.toString('utf8'));
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
  const manifest = await readJsonBlob(MANIFEST_PATH);
  if (manifest && typeof manifest === 'object') return manifest;
  return {
    updatedAt: null,
    datasets: {},
  };
}

async function writeManifest(manifest) {
  const next = {
    updatedAt: new Date().toISOString(),
    datasets: manifest.datasets || {},
  };
  await writeJsonBlob(MANIFEST_PATH, next);
  return next;
}

async function uploadDataset({ fileType, fileName, buffer, contentType }) {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  if (!DATASET_TYPES.includes(fileType)) throw new Error('Invalid dataset type');

  const extension = fileName && fileName.includes('.') ? fileName.split('.').pop() : 'xlsx';
  const pathname = `company-search/datasets/${fileType}.${extension || 'xlsx'}`;
  const uploaded = await put(pathname, buffer, {
    access: 'private',
    contentType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });

  const manifest = await readManifest();
  manifest.datasets[fileType] = {
    fileType,
    fileName,
    pathname: uploaded.pathname,
    url: uploaded.url,
    downloadUrl: uploaded.downloadUrl,
    contentType: uploaded.contentType,
    uploadedAt: new Date().toISOString(),
  };
  const nextManifest = await writeManifest(manifest);
  cache.delete(fileType);
  return { uploaded, manifest: nextManifest };
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

  const blobMeta = await head(meta.pathname, { token });
  const cached = cache.get(fileType);
  if (cached && cached.etag === blobMeta.etag) return cached.dataset;

  const result = await get(meta.pathname, { access: 'private', token, useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const buffer = await streamToBuffer(result.stream);
  const parsed = await parseDatasetBuffer(buffer, fileType, meta.fileName || meta.pathname);
  cache.set(fileType, { etag: blobMeta.etag, dataset: parsed });
  return parsed;
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
};
