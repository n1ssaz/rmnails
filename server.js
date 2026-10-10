'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;

(function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) return;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
})();

const PORT = Number(process.env.PORT) || 5178;
const PRIVATE = path.join(ROOT, 'private');
const store = require('./storage')(ROOT);

const MAX_JSON = 2 * 1024 * 1024;
const MAX_IMAGE = 12 * 1024 * 1024;
const SESSION_HOURS = 12;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2'
};

function hashPassword(pw, salt) {
  return crypto.pbkdf2Sync(pw, salt, 210000, 32, 'sha256').toString('hex');
}
async function loadAuth() {
  const existing = await store.getAuth();
  if (existing) return existing;
  const fromEnv = process.env.ADMIN_PASSWORD;
  const pw = fromEnv || crypto.randomBytes(9).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const created = { salt, hash: hashPassword(pw, salt) };
  await store.saveAuth(created);
  if (!fromEnv) {
    fs.mkdirSync(PRIVATE, { recursive: true });
    fs.writeFileSync(path.join(PRIVATE, 'ADMIN-PASSWORD.txt'),
      'Admin password (change it in Admin > Siguria, then delete this file):\n' + pw + '\n', { mode: 0o600 });
    console.log('\n  A new admin password was created: see private/ADMIN-PASSWORD.txt\n');
  }
  return created;
}
let auth = null;

const sessions = new Map();
const failures = new Map();

function newSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, Date.now() + SESSION_HOURS * 3600e3);
  return token;
}
function getCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function isAuthed(req) {
  const t = getCookie(req, 'rm_session');
  const exp = t && sessions.get(t);
  if (!exp) return false;
  if (exp < Date.now()) { sessions.delete(t); return false; }
  return true;
}
function checkPassword(pw) {
  const a = Buffer.from(hashPassword(String(pw || ''), auth.salt), 'hex');
  const b = Buffer.from(auth.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function send(res, code, body, headers) {
  const isObj = body && typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, Object.assign({
    'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff'
  }, headers || {}));
  res.end(isObj ? JSON.stringify(body) : body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function validContent(c) {
  return c && typeof c === 'object' && !Array.isArray(c) &&
    Array.isArray(c.services) && c.text && typeof c.text === 'object' &&
    c.settings && typeof c.settings === 'object' && c.schedule && typeof c.schedule === 'object';
}

async function api(req, res, url) {
  const route = url.pathname.replace(/^\/api\//, '');
  const mutating = req.method !== 'GET';

  if (mutating && req.headers['x-rm-admin'] !== '1') return send(res, 403, { error: 'Forbidden' });

  if (route === 'session' && req.method === 'GET') return send(res, 200, { authed: isAuthed(req) });

  if (route === 'login' && req.method === 'POST') {
    const ip = req.socket.remoteAddress || '?';
    const f = failures.get(ip);
    if (f && f.until > Date.now()) return send(res, 429, { error: 'Shumë tentativa. Provo pas pak minutash.' });
    let body; try { body = JSON.parse((await readBody(req, 4096)).toString('utf8')); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    if (!checkPassword(body.password)) {
      const n = (f && f.until < Date.now() ? 0 : (f ? f.n : 0)) + 1;
      failures.set(ip, { n, until: n >= 5 ? Date.now() + 5 * 60e3 : 0 });
      return send(res, 401, { error: 'Fjalëkalim i gabuar' });
    }
    failures.delete(ip);
    const token = newSession();
    return send(res, 200, { ok: true }, {
      'Set-Cookie': 'rm_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + SESSION_HOURS * 3600
    });
  }

  if (route === 'logout' && req.method === 'POST') {
    const t = getCookie(req, 'rm_session'); if (t) sessions.delete(t);
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'rm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  }

  if (!isAuthed(req)) return send(res, 401, { error: 'Not logged in' });

  if (route === 'content' && req.method === 'PUT') {
    let c; try { c = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8')); } catch (e) { return send(res, e.code || 400, { error: 'Invalid JSON' }); }
    if (!validContent(c)) return send(res, 400, { error: 'Invalid content' });
    c.updatedAt = new Date().toISOString();
    await store.saveContent(JSON.stringify(c, null, 2));
    return send(res, 200, { ok: true, updatedAt: c.updatedAt });
  }

  if (route === 'upload' && req.method === 'POST') {
    const name = url.searchParams.get('name') || '';

    if (!/^[a-z0-9][a-z0-9-]{0,60}\.(jpg|jpeg|png|webp)$/.test(name)) return send(res, 400, { error: 'Bad file name' });
    const type = (req.headers['content-type'] || '').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(type)) return send(res, 415, { error: 'Only JPG, PNG or WEBP' });
    let buf; try { buf = await readBody(req, MAX_IMAGE); } catch (e) { return send(res, e.code || 400, { error: 'Image too large' }); }
    const sig = buf.slice(0, 12).toString('hex');
    const ok = sig.startsWith('ffd8ff') || sig.startsWith('89504e47') || (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP');
    if (!ok) return send(res, 415, { error: 'Not an image' });
    await store.putImage(name, buf, type);
    return send(res, 200, { ok: true, name, version: Date.now() });
  }

  if (route === 'password' && req.method === 'POST') {
    let body; try { body = JSON.parse((await readBody(req, 4096)).toString('utf8')); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    if (!checkPassword(body.current)) return send(res, 401, { error: 'Fjalëkalimi aktual është i gabuar' });
    if (typeof body.next !== 'string' || body.next.length < 8) return send(res, 400, { error: 'Fjalëkalimi i ri duhet të ketë të paktën 8 karaktere' });
    const salt = crypto.randomBytes(16).toString('hex');
    auth = { salt, hash: hashPassword(body.next, salt) };
    await store.saveAuth(auth);
    const pwFile = path.join(PRIVATE, 'ADMIN-PASSWORD.txt');
    if (fs.existsSync(pwFile)) fs.unlinkSync(pwFile);
    return send(res, 200, { ok: true });
  }

  return send(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
  if (rel.endsWith('/')) rel += 'index.html';
  const parts = rel.split('/').filter(Boolean);

  if (parts.some(p => p.startsWith('.')) || ['private', 'node_modules'].includes(parts[0]) ||
      ['/server.js', '/storage.js', '/package.json', '/package-lock.json'].includes(rel)) {
    return send(res, 404, 'Not found');
  }
  const file = path.join(ROOT, ...parts);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 404, 'Not found');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' };

    headers['Cache-Control'] = (parts[0] === 'data' || parts[0] === 'admin' || ext === '.html') ? 'no-store' : 'no-cache';
    if (parts[0] === 'admin') headers['X-Frame-Options'] = 'DENY';
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

async function serveDynamic(req, res, url) {
  if (url.pathname === '/data/content.json') {
    const json = await store.getContent();
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : json);
    return true;
  }
  const m = url.pathname.match(/^\/images\/([a-z0-9][a-z0-9-]{0,60}\.(?:jpg|jpeg|png|webp))$/);
  if (m) {
    const img = await store.getImage(m[1]);
    if (!img) return false;
    res.writeHead(200, { 'Content-Type': img.type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : img.data);
    return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch(err => { console.error(err); send(res, 500, { error: 'Server error' }); });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  serveDynamic(req, res, url)
    .then(done => { if (!done) serveStatic(req, res, url); })
    .catch(err => { console.error(err); send(res, 500, 'Server error'); });
});

(async () => {
  await store.init();
  auth = await loadAuth();
  server.listen(PORT, () => {
    console.log('RM Nails Suite running at http://localhost:' + PORT + '  (admin: /admin/, storage: ' + store.kind + ')');
  });
})().catch(err => {
  console.error('Could not start: ' + err.message);
  process.exit(1);
});
