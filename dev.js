// Local dev server that runs the same api/ functions Vercel runs, plus the static files in public/.
// Usage: npm run dev   (reads .env.local)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function resolveApi(pathname) {
  const parts = pathname.replace(/^\/api\//, '').replace(/\/$/, '').split('/');
  const direct = path.join(ROOT, 'api', ...parts) + '.js';
  if (fs.existsSync(direct)) return { file: direct, query: {} };
  const index = path.join(ROOT, 'api', ...parts, 'index.js');
  if (fs.existsSync(index)) return { file: index, query: {} };
  if (parts.length > 1) {
    const dyn = path.join(ROOT, 'api', ...parts.slice(0, -1), '[id].js');
    if (fs.existsSync(dyn)) return { file: dyn, query: { id: parts[parts.length - 1] } };
  }
  return null;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const target = resolveApi(url.pathname);
    if (!target) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"error":"Not found."}'); }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try { req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; } catch { req.body = {}; }
    req.query = { ...Object.fromEntries(url.searchParams), ...target.query };
    res.status = (n) => { res.statusCode = n; return res; };
    res.json = (o) => { res.setHeader('content-type', 'application/json; charset=utf-8'); res.end(JSON.stringify(o)); return res; };
    return require(target.file)(req, res);
  }
  const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found');
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}`));
