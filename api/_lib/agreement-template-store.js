const { put, del } = require('@vercel/blob');
const { readManifest, writeManifest, resolveToken } = require('./blob-store');

const TEMPLATE_MANIFEST_KEY = 'agreementTemplates';
const TEMPLATE_ROOT_LABEL = 'Vercel Blob / templates/agreement-board';

function ensureToken() {
  const token = resolveToken();
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not configured');
  return token;
}

function normalizeManifest(manifest) {
  const base = manifest && typeof manifest === 'object' ? manifest : { updatedAt: null, datasets: {} };
  const templates = base[TEMPLATE_MANIFEST_KEY] && typeof base[TEMPLATE_MANIFEST_KEY] === 'object'
    ? base[TEMPLATE_MANIFEST_KEY]
    : {};
  return { ...base, [TEMPLATE_MANIFEST_KEY]: templates };
}

function sanitizeTemplateKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

function resolveExtension(fileName = '') {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.xlsm')) return 'xlsm';
  if (lower.endsWith('.xls')) return 'xls';
  return 'xlsx';
}

function buildTemplatePath(templateKey, extension = 'xlsx') {
  return `company-search/templates/agreement-board/${templateKey}.${extension}`;
}

async function listAgreementTemplates() {
  const manifest = normalizeManifest(await readManifest());
  return manifest[TEMPLATE_MANIFEST_KEY];
}

async function uploadAgreementTemplate({
  templateKey,
  fileName,
  contentType,
  buffer,
}) {
  const token = ensureToken();
  const normalizedKey = sanitizeTemplateKey(templateKey);
  if (!normalizedKey) throw new Error('templateKey is required');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('template file is required');

  const extension = resolveExtension(fileName);
  const pathname = buildTemplatePath(normalizedKey, extension);
  const uploaded = await put(pathname, buffer, {
    access: 'private',
    contentType: contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    allowOverwrite: true,
    addRandomSuffix: false,
    token,
  });

  const manifest = normalizeManifest(await readManifest());
  const current = manifest[TEMPLATE_MANIFEST_KEY][normalizedKey] || {};
  manifest[TEMPLATE_MANIFEST_KEY][normalizedKey] = {
    ...current,
    templateKey: normalizedKey,
    fileName: fileName || `${normalizedKey}.${extension}`,
    pathname: uploaded.pathname,
    contentType: uploaded.contentType,
    uploadedAt: new Date().toISOString(),
    size: Buffer.byteLength(buffer),
  };
  await writeManifest(manifest);
  return manifest[TEMPLATE_MANIFEST_KEY][normalizedKey];
}

async function deleteAgreementTemplate(templateKey) {
  const token = ensureToken();
  const normalizedKey = sanitizeTemplateKey(templateKey);
  if (!normalizedKey) throw new Error('templateKey is required');
  const manifest = normalizeManifest(await readManifest());
  const meta = manifest[TEMPLATE_MANIFEST_KEY][normalizedKey];
  if (meta?.pathname) {
    await del(meta.pathname, { token });
  }
  delete manifest[TEMPLATE_MANIFEST_KEY][normalizedKey];
  await writeManifest(manifest);
}

module.exports = {
  TEMPLATE_ROOT_LABEL,
  listAgreementTemplates,
  uploadAgreementTemplate,
  deleteAgreementTemplate,
};

