// Run after npm run build: node scripts/verify-static-modules.js
// Exercise the real server handler without opening ports or touching application data.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { Writable } = require('node:stream');
const { once } = require('node:events');

async function main() {
  const root = path.resolve(__dirname, '..');
  const filename = path.join(root, 'server.js');
  const serverRequire = createRequire(filename);
  let handler;
  vm.runInNewContext(await fs.readFile(filename, 'utf8'), {
    require: (name) => {
      if (name === 'http') return { createServer: (callback) => { handler = callback; return { listen() {} }; } };
      if (name === './api/_lib/auth-store') return { getSessionFromRequest: () => null };
      return serverRequire(name);
    },
    __dirname: root, process: { env: {} }, URL, console,
  }, { filename });
  const assets = await fs.readdir(path.join(root, 'dist/assets'));
  const worker = assets.find((file) => /^pdf\.worker\.min-.+\.js$/.test(file));
  assert.ok(worker, 'Build must include the PDF worker module');
  assert.ok(!assets.some((file) => /^pdf\.worker\.min-.+\.mjs$/.test(file)), 'Built worker must use a .js filename for existing servers');
  for (const file of [worker, assets.find((name) => /^pdf-.+\.js$/.test(name))]) {
    assert.ok(file);
    const headers = {};
    const chunks = [];
    const response = new Writable({ write(chunk, encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    response.setHeader = (name, value) => { headers[name.toLowerCase()] = value; };
    const finished = once(response, 'finish');
    await handler({ method: 'GET', url: `/assets/${file}` }, response);
    await finished;
    assert.equal(response.statusCode, 200);
    assert.match(headers['content-type'], /^application\/javascript\b/);
    assert.deepEqual(Buffer.concat(chunks), await fs.readFile(path.join(root, 'dist/assets', file)));
  }
  console.log('PASS: PDF worker and renderer use .js URLs and are served as JavaScript with unchanged contents');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
