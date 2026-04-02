const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const DIST_DIR = path.join(__dirname, 'dist');
const API_DIR = path.join(__dirname, 'api');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.txt': 'text/plain; charset=utf-8',
};

const normalizePath = (inputPath) => {
  try {
    return decodeURIComponent(inputPath);
  } catch {
    return inputPath;
  }
};

const resolveApiHandlerPath = (requestPath) => {
  const relative = requestPath.replace(/^\/api\/?/, '');
  if (!relative) return null;
  const sanitized = relative.replace(/^\/+/, '');
  if (sanitized.includes('..')) return null;

  const direct = path.join(API_DIR, `${sanitized}.js`);
  const indexFile = path.join(API_DIR, sanitized, 'index.js');
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) return indexFile;
  return null;
};

const serveFile = (res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  fs.createReadStream(filePath).pipe(res);
};

const serveSpa = (res) => {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, message: 'dist/index.html not found. Run npm run build first.' }));
    return;
  }
  serveFile(res, indexPath);
};

const serveStatic = (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rawPath = normalizePath(url.pathname || '/');
  const normalized = rawPath === '/' ? '/index.html' : rawPath;
  const requestedPath = path.normalize(normalized).replace(/^(\.\.[/\\])+/, '');
  const absolute = path.join(DIST_DIR, requestedPath);
  const distRoot = `${path.resolve(DIST_DIR)}${path.sep}`;
  const resolved = path.resolve(absolute);

  if (!resolved.startsWith(distRoot) && resolved !== path.resolve(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    serveFile(res, resolved);
    return;
  }
  serveSpa(res);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = normalizePath(url.pathname || '/');

  if (pathname.startsWith('/api/')) {
    const handlerPath = resolveApiHandlerPath(pathname);
    if (!handlerPath) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: 'API route not found' }));
      return;
    }

    try {
      delete require.cache[require.resolve(handlerPath)];
      const handler = require(handlerPath);
      if (typeof handler !== 'function') {
        throw new Error(`Invalid API handler: ${handlerPath}`);
      }
      await handler(req, res);
      return;
    } catch (error) {
      console.error('[server] API error:', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: error?.message || 'Internal server error' }));
      } else {
        res.end();
      }
      return;
    }
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`[server] http://${HOST}:${PORT}`);
});
