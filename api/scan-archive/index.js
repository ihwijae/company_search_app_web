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

const SEARCH_FILTER = {
  ALL: 'all',
  ELECTRIC: 'electric',
  COMMUNICATION: 'communication',
  FIRE: 'fire',
  CREDIT: 'credit',
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

function sanitizeEntryName(input, fallback = '새 항목') {
  const value = String(input || '').trim();
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sanitized || sanitized === '.' || sanitized === '..') return fallback;
  return sanitized;
}

function joinRelativePath(dir, name) {
  const normalizedDir = normalizeRelativeDir(dir);
  const safeName = sanitizeEntryName(name);
  return normalizedDir ? `${normalizedDir}/${safeName}` : safeName;
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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function readMultipartForm(req) {
  const host = req.headers.host || 'localhost';
  const request = new Request(`http://${host}${req.url || '/'}`, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
  return request.formData();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 0;
  return bytes;
}

function buildFileEntry({ name, relativePath, stat, type, ext }) {
  const isDirectory = type === 'dir';
  return {
    name,
    path: relativePath,
    type,
    ext: isDirectory ? '' : ext,
    size: isDirectory ? null : formatBytes(stat.size),
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
    previewable: !isDirectory && (IMAGE_EXTENSIONS.has(ext) || PDF_EXTENSIONS.has(ext)),
  };
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
    return buildFileEntry({
      name,
      type: isDirectory ? 'dir' : 'file',
      relativePath: childRelative,
      stat: childStat,
      ext,
    });
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
      collected.push({ absolute, relative, stat });
    }
  }
  return collected;
}

function matchesFileTypeFilter(fileName, filter) {
  if (!filter || filter === SEARCH_FILTER.ALL) return true;
  if (filter === SEARCH_FILTER.ELECTRIC) return fileName.includes('전기경영상태');
  if (filter === SEARCH_FILTER.COMMUNICATION) return fileName.includes('통신경영상태');
  if (filter === SEARCH_FILTER.FIRE) return fileName.includes('소방경영상태');
  if (filter === SEARCH_FILTER.CREDIT) return fileName.includes('신용평가');
  return true;
}

async function searchFiles(root, query, filter = SEARCH_FILTER.ALL) {
  const keyword = String(query || '').trim().toLowerCase();
  if (!keyword) {
    return { count: 0, results: [] };
  }

  await fs.promises.mkdir(root, { recursive: true });
  const stat = await fs.promises.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    return { count: 0, results: [] };
  }

  const files = await collectFilesRecursive(root, root);
  const results = files
    .map((item) => {
      const relativePath = item.relative;
      const name = path.basename(relativePath);
      const dir = path.dirname(relativePath);
      return {
        ...buildFileEntry({
          name,
          relativePath,
          stat: item.stat,
          type: 'file',
          ext: path.extname(name).toLowerCase(),
        }),
        dirPath: dir === '.' ? '' : dir,
      };
    })
    .filter((item) => {
      if (!matchesFileTypeFilter(item.name, filter)) return false;
      return item.name.toLowerCase().includes(keyword);
    })
    .sort((a, b) => a.path.localeCompare(b.path, 'ko'));

  return {
    count: results.length,
    results: results.slice(0, 200),
  };
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    allowMethods(res, ['GET', 'POST', 'DELETE']);
    return sendJson(res, 405, { success: false, message: 'Method not allowed' });
  }

  const url = new URL(req.url, 'http://localhost');
  const action = String(url.searchParams.get('action') || 'list').trim().toLowerCase();
  const root = resolveArchiveRoot();

  if (req.method === 'POST') {
    if (action === 'create-folder') {
      try {
        const body = await readJsonBody(req);
        const dir = String(body.dir || '');
        const name = sanitizeEntryName(body.name, '');
        if (!name) return sendJson(res, 400, { success: false, message: '폴더명을 입력하세요.' });
        const relativePath = joinRelativePath(dir, name);
        const { normalized, absolute } = resolveTargetPath(root, relativePath);
        const existing = await fs.promises.stat(absolute).catch(() => null);
        if (existing) return sendJson(res, 409, { success: false, message: '같은 이름의 항목이 이미 있습니다.' });
        await fs.promises.mkdir(absolute, { recursive: false });
        return sendJson(res, 200, {
          success: true,
          message: '폴더를 생성했습니다.',
          data: { path: normalized, name },
        });
      } catch (error) {
        return sendJson(res, 400, { success: false, message: error?.message || 'Folder create failed' });
      }
    }

    if (action === 'rename-folder') {
      try {
        const body = await readJsonBody(req);
        const sourcePath = String(body.path || '').trim();
        const nextName = sanitizeEntryName(body.name, '');
        if (!sourcePath) return sendJson(res, 400, { success: false, message: '폴더 경로가 필요합니다.' });
        if (!nextName) return sendJson(res, 400, { success: false, message: '폴더명을 입력하세요.' });
        const { normalized, absolute } = resolveTargetPath(root, sourcePath);
        const stat = await fs.promises.stat(absolute);
        if (!stat.isDirectory()) return sendJson(res, 400, { success: false, message: '폴더만 이름을 바꿀 수 있습니다.' });
        const parent = path.posix.dirname(normalized);
        const nextRelative = parent === '.' ? nextName : `${parent}/${nextName}`;
        const target = resolveTargetPath(root, nextRelative);
        const existing = await fs.promises.stat(target.absolute).catch(() => null);
        if (existing) return sendJson(res, 409, { success: false, message: '같은 이름의 항목이 이미 있습니다.' });
        await fs.promises.rename(absolute, target.absolute);
        return sendJson(res, 200, {
          success: true,
          message: '폴더명을 변경했습니다.',
          data: { oldPath: normalized, path: target.normalized, name: nextName },
        });
      } catch (error) {
        return sendJson(res, 400, { success: false, message: error?.message || 'Folder rename failed' });
      }
    }

    if (action === 'upload-file') {
      try {
        const form = await readMultipartForm(req);
        const dir = String(form.get('dir') || '');
        const uploaded = form.get('file');
        if (!uploaded || typeof uploaded.arrayBuffer !== 'function') {
          return sendJson(res, 400, { success: false, message: '업로드할 파일을 선택하세요.' });
        }

        const originalName = sanitizeEntryName(uploaded.name || 'upload.bin', 'upload.bin');
        const originalExt = path.extname(originalName);
        const requestedNameRaw = String(form.get('fileName') || '').trim();
        const overwrite = String(form.get('overwrite') || '').trim() === '1';
        let fileName = sanitizeEntryName(requestedNameRaw || originalName, originalName);
        if (!path.extname(fileName) && originalExt) fileName = `${fileName}${originalExt}`;

        const relativePath = joinRelativePath(dir, fileName);
        const { normalized, absolute } = resolveTargetPath(root, relativePath);
        const parentDir = path.dirname(absolute);
        const parentStat = await fs.promises.stat(parentDir).catch(() => null);
        if (!parentStat || !parentStat.isDirectory()) {
          return sendJson(res, 400, { success: false, message: '저장할 폴더가 없습니다.' });
        }
        const existing = await fs.promises.stat(absolute).catch(() => null);
        if (existing?.isDirectory()) {
          return sendJson(res, 409, {
            success: false,
            code: 'ENTRY_EXISTS',
            message: '같은 이름의 폴더가 이미 있습니다.',
            data: { path: normalized, name: fileName, type: 'dir' },
          });
        }
        if (existing && !overwrite) {
          return sendJson(res, 409, {
            success: false,
            code: 'FILE_EXISTS',
            message: '같은 이름의 파일이 이미 있습니다.',
            data: { path: normalized, name: fileName, type: 'file' },
          });
        }

        const buffer = Buffer.from(await uploaded.arrayBuffer());
        if (buffer.length === 0) return sendJson(res, 400, { success: false, message: '빈 파일은 업로드할 수 없습니다.' });
        await fs.promises.writeFile(absolute, buffer);
        return sendJson(res, 200, {
          success: true,
          message: existing ? '파일을 덮어썼습니다.' : '파일을 업로드했습니다.',
          data: { path: normalized, name: fileName },
        });
      } catch (error) {
        return sendJson(res, 400, { success: false, message: error?.message || 'File upload failed' });
      }
    }

    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  if (req.method === 'DELETE') {
    if (action !== 'delete') {
      return sendJson(res, 400, { success: false, message: 'Invalid action' });
    }

    try {
      const relativePath = String(url.searchParams.get('path') || '').trim();
      if (!relativePath) {
        return sendJson(res, 400, { success: false, message: 'File path is required' });
      }
      const { normalized, absolute } = resolveTargetPath(root, relativePath);
      const stat = await fs.promises.stat(absolute);
      if (stat.isDirectory()) {
        await fs.promises.rm(absolute, { recursive: true, force: false });
        return sendJson(res, 200, {
          success: true,
          message: '폴더를 삭제했습니다.',
          data: { path: normalized, name: path.basename(absolute), type: 'dir' },
        });
      }
      if (stat.isFile()) {
        await fs.promises.unlink(absolute);
        return sendJson(res, 200, {
          success: true,
          message: '파일을 삭제했습니다.',
          data: { path: normalized, name: path.basename(absolute), type: 'file' },
        });
      }
      return sendJson(res, 400, { success: false, message: '삭제할 수 없는 항목입니다.' });
    } catch (error) {
      return sendJson(res, 400, { success: false, message: error?.message || 'Delete failed' });
    }
  }

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

  if (action === 'search') {
    try {
      const q = String(url.searchParams.get('q') || '').trim();
      const fileType = String(url.searchParams.get('fileType') || SEARCH_FILTER.ALL).trim().toLowerCase();
      const result = await searchFiles(root, q, fileType);
      return sendJson(res, 200, {
        success: true,
        data: result,
      });
    } catch (error) {
      return sendJson(res, 400, { success: false, message: error?.message || 'Search failed' });
    }
  }

  return sendJson(res, 400, { success: false, message: 'Invalid action' });
};
