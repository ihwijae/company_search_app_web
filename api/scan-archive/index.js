const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { sendJson, allowMethods } = require('../_lib/http');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);
const PDF_EXTENSIONS = new Set(['.pdf']);

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveArchiveRoot() {
  const configured = String(process.env.EXCEL_EDIT_ARCHIVE_ROOT || '').trim();
  if (configured) return path.resolve(configured);

  const homeRoot = path.join(os.homedir(), 'app-data', '스캔본');
  return path.resolve(homeRoot);
}

function normalizeRelativeDir(input) {
  const value = String(input || '').trim().replace(/\\/g, '/');
  if (!value || value === '.' || value === '/') return '';
  const normalized = path.posix.normalize(value).replace(/^\/+/, '');
  if (normalized.startsWith('..')) {
    throw new Error('Invalid directory path');
  }
  return normalized;
}

function resolveTargetPath(root, relativePath) {
  const normalized = normalizeRelativeDir(relativePath);
  const target = path.resolve(root, normalized);
  const rootWithSep = `${path.resolve(root)}${path.sep}`;
  if (target !== path.resolve(root) && !target.startsWith(rootWithSep)) {
    throw new Error('Path traversal is not allowed');
  }
  return { normalized, absolute: target };
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 0;
  return bytes;
}

function buildBreadcrumbs(relativeDir) {
  const crumbs = [{ name: '스캔본', path: '' }];
  if (!relativeDir) return crumbs;
  const parts = relativeDir.split('/').filter(Boolean);
  let cursor = '';
  parts.forEach((part) => {
    cursor = cursor ? `${cursor}/${part}` : part;
    crumbs.push({ name: part, path: cursor });
  });
  return crumbs;
}

function isHiddenMetaFile(name) {
  const normalized = String(name || '').toLowerCase();
  return normalized.includes(':zone.identifier');
}

async function listDirectory(root, relativeDir) {
  const { normalized, absolute } = resolveTargetPath(root, relativeDir);
  await fs.promises.mkdir(root, { recursive: true });
  const stat = await fs.promises.stat(absolute).catch(() => null);
  if (!stat) {
    return {
      currentPath: normalized,
      breadcrumbs: buildBreadcrumbs(normalized),
      entries: [],
    };
  }
  if (!stat.isDirectory()) {
    throw new Error('Target is not a directory');
  }

  const names = await fs.promises.readdir(absolute);
  const entries = await Promise.all(names.map(async (name) => {
    if (isHiddenMetaFile(name)) return null;
    const childRelative = normalized ? `${normalized}/${name}` : name;
    const childAbsolute = path.join(absolute, name);
    const childStat = await fs.promises.stat(childAbsolute);
    const ext = path.extname(name).toLowerCase();
    const isDirectory = childStat.isDirectory();
    return {
      name,
      path: childRelative,
      type: isDirectory ? 'dir' : 'file',
      ext: isDirectory ? '' : ext,
      size: isDirectory ? null : formatBytes(childStat.size),
      updatedAt: childStat.mtime.toISOString(),
      previewable: !isDirectory && (IMAGE_EXTENSIONS.has(ext) || PDF_EXTENSIONS.has(ext)),
    };
  }));

  const sanitizedEntries = entries.filter(Boolean);

  sanitizedEntries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });

  return {
    currentPath: normalized,
    breadcrumbs: buildBreadcrumbs(normalized),
    entries: sanitizedEntries,
  };
}

async function collectFilesRecursive(baseDirAbsolute, targetDirAbsolute) {
  const collected = [];
  const queue = [targetDirAbsolute];
  while (queue.length > 0) {
    const currentDir = queue.shift();
    const names = await fs.promises.readdir(currentDir);
    for (const name of names) {
      if (isHiddenMetaFile(name)) continue;
      const absolute = path.join(currentDir, name);
      const stat = await fs.promises.stat(absolute);
      if (stat.isDirectory()) {
        queue.push(absolute);
        continue;
      }
      if (!stat.isFile()) continue;
      const relative = path.relative(baseDirAbsolute, absolute).split(path.sep).join('/');
      collected.push({ absolute, relative });
    }
  }
  return collected;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  const url = new URL(req.url, 'http://localhost');
  const action = String(url.searchParams.get('action') || 'list').trim().toLowerCase();
  const root = resolveArchiveRoot();

  if (action === 'list') {
    try {
      const dir = url.searchParams.get('dir') || '';
      const payload = await listDirectory(root, dir);
      return sendJson(res, 200, {
        success: true,
        data: {
          root,
          ...payload,
        },
      });
    } catch (error) {
      return sendJson(res, 400, { success: false, message: error?.message || 'Directory listing failed' });
    }
  }

  if (action === 'file') {
    try {
      const relativePath = String(url.searchParams.get('path') || '').trim();
      if (!relativePath) {
        return sendJson(res, 400, { success: false, message: 'File path is required' });
      }
      const { absolute } = resolveTargetPath(root, relativePath);
      const stat = await fs.promises.stat(absolute);
      if (!stat.isFile()) {
        return sendJson(res, 400, { success: false, message: 'Target is not a file' });
      }

      const fileName = path.basename(absolute);
      const ext = path.extname(fileName).toLowerCase();
      const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
      const shouldDownload = String(url.searchParams.get('download') || '').trim() === '1';
      const encodedName = encodeURIComponent(fileName);

      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        shouldDownload
          ? `attachment; filename*=UTF-8''${encodedName}`
          : `inline; filename*=UTF-8''${encodedName}`,
      );
      fs.createReadStream(absolute).pipe(res);
      return;
    } catch (error) {
      return sendJson(res, 400, { success: false, message: error?.message || 'File read failed' });
    }
  }

  if (action === 'download-all') {
    try {
      const dir = url.searchParams.get('dir') || '';
      const { normalized, absolute } = resolveTargetPath(root, dir);
      const stat = await fs.promises.stat(absolute).catch(() => null);
      if (!stat || !stat.isDirectory()) {
        return sendJson(res, 400, { success: false, message: 'Target directory does not exist' });
      }

      const files = await collectFilesRecursive(absolute, absolute);
      const zip = new AdmZip();
      files.forEach((item) => {
        const zipPath = path.dirname(item.relative);
        zip.addLocalFile(item.absolute, zipPath === '.' ? '' : zipPath, path.basename(item.relative));
      });
      const zipBuffer = zip.toBuffer();
      const zipName = normalized
        ? `${normalized.replace(/\//g, '_')}_스캔본.zip`
        : '스캔본_전체.zip';
      const encodedName = encodeURIComponent(zipName);

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
      res.end(zipBuffer);
      return;
    } catch (error) {
      return sendJson(res, 400, { success: false, message: error?.message || 'Zip download failed' });
    }
  }

  return sendJson(res, 400, { success: false, message: 'Invalid action' });
};
