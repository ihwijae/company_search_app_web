const fs = require('fs');
const os = require('os');
const path = require('path');

const resolveAppDataRoot = () => {
  const fromEnv = String(process.env.COMPANY_SEARCH_APP_DATA_ROOT || '').trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.homedir(), 'app-data', 'company-search');
};

const APP_DATA_ROOT = resolveAppDataRoot();
const ROOTS = {
  datasets: path.join(APP_DATA_ROOT, 'uploads', 'master-files'),
  config: path.join(APP_DATA_ROOT, 'config'),
  records: path.join(APP_DATA_ROOT, 'records'),
  recordAttachments: path.join(APP_DATA_ROOT, 'records', 'attachments'),
  agreementBoards: path.join(APP_DATA_ROOT, 'agreement-board'),
  mailAttachments: path.join(APP_DATA_ROOT, 'mail-attachments'),
};

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
  return dirPath;
};

const readJsonFile = async (filePath, fallback = null) => {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const writeJsonFile = async (filePath, value) => {
  await ensureDir(path.dirname(filePath));
  await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
  return value;
};

const sanitizeFileName = (value, fallback = 'file') => {
  const normalized = String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
  return normalized || fallback;
};

const buildSafeRelativePath = (...segments) => path.join(...segments.map((segment) => sanitizeFileName(segment, 'item')));

const resolveWithinRoot = (rootPath, relativePath = '') => {
  const target = path.resolve(rootPath, relativePath);
  const normalizedRoot = `${path.resolve(rootPath)}${path.sep}`;
  if (target !== path.resolve(rootPath) && !target.startsWith(normalizedRoot)) {
    throw new Error('Invalid storage path');
  }
  return target;
};

const writeBinaryFile = async (rootPath, relativePath, buffer) => {
  await ensureDir(rootPath);
  const targetPath = resolveWithinRoot(rootPath, relativePath);
  await ensureDir(path.dirname(targetPath));
  await fs.promises.writeFile(targetPath, buffer);
  return targetPath;
};

module.exports = {
  APP_DATA_ROOT,
  ROOTS,
  ensureDir,
  readJsonFile,
  writeJsonFile,
  sanitizeFileName,
  buildSafeRelativePath,
  resolveWithinRoot,
  writeBinaryFile,
};
