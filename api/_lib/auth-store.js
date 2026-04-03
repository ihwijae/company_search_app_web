const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ROOTS } = require('./local-storage');

const SESSION_COOKIE_NAME = 'company_search_sid';
const DEFAULT_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_TTL_MS = Number(process.env.AUTH_SESSION_TTL_MS || DEFAULT_SESSION_TTL_MS);
const sessions = new Map();

const isProduction = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

function parseCookies(header = '') {
  const out = {};
  const source = String(header || '');
  if (!source) return out;
  source.split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index < 0) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) return;
    out[key] = decodeURIComponent(value);
  });
  return out;
}

function resolveUsersFilePath() {
  const fromEnv = String(process.env.AUTH_USERS_FILE || '').trim();
  if (fromEnv) return path.resolve(fromEnv);

  const configPath = path.join(ROOTS.config, 'users.yaml');
  if (fs.existsSync(configPath)) return configPath;

  return path.resolve(process.cwd(), 'users.yaml');
}

async function readUsersDocument() {
  const filePath = resolveUsersFilePath();
  try {
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      filePath,
      version: Number(parsed?.version || 1),
      users: Array.isArray(parsed?.users) ? parsed.users : [],
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { filePath, version: 1, users: [] };
    }
    throw new Error(`Failed to parse users file (${filePath}). Use JSON-compatible YAML.`);
  }
}

function parseScryptHash(hash = '') {
  if (!String(hash).startsWith('scrypt$')) return null;
  const parts = String(hash).split('$');
  if (parts.length !== 4) return null;

  const paramsPart = parts[1] || '';
  const saltBase64 = parts[2] || '';
  const keyBase64 = parts[3] || '';
  const params = {};

  paramsPart.split(',').forEach((entry) => {
    const [k, v] = entry.split('=');
    if (!k || !v) return;
    params[k.trim()] = Number(v.trim());
  });

  if (!params.N || !params.r || !params.p) return null;
  if (!saltBase64 || !keyBase64) return null;
  return {
    N: params.N,
    r: params.r,
    p: params.p,
    salt: Buffer.from(saltBase64, 'base64'),
    key: Buffer.from(keyBase64, 'base64'),
  };
}

function verifyPassword(password, passwordHash) {
  const parsed = parseScryptHash(passwordHash);
  if (!parsed) return false;

  const derived = crypto.scryptSync(password, parsed.salt, parsed.key.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
  });
  if (derived.length !== parsed.key.length) return false;
  return crypto.timingSafeEqual(derived, parsed.key);
}

function cleanupExpiredSessions(now = Date.now()) {
  for (const [sessionId, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

function createSession(user) {
  cleanupExpiredSessions();
  const now = Date.now();
  const sessionId = crypto.randomBytes(32).toString('base64url');
  const normalizedUser = user && typeof user === 'object'
    ? user
    : { id: String(user || '').trim() };
  sessions.set(sessionId, {
    user: {
      id: String(normalizedUser.id || '').trim(),
      name: String(normalizedUser.name || normalizedUser.id || '').trim(),
      role: String(normalizedUser.role || 'user').trim() || 'user',
      mustChangePassword: Boolean(normalizedUser.mustChangePassword),
    },
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });
  return { sessionId, maxAgeMs: SESSION_TTL_MS };
}

function invalidateSession(sessionId) {
  if (!sessionId) return;
  sessions.delete(sessionId);
}

function getSessionFromRequest(req) {
  cleanupExpiredSessions();
  const cookies = parseCookies(req?.headers?.cookie || '');
  const sessionId = String(cookies[SESSION_COOKIE_NAME] || '').trim();
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }
  return { sessionId, ...session };
}

function buildSetCookieValue(sessionId, maxAgeMs) {
  const maxAgeSec = Math.max(0, Math.floor(Number(maxAgeMs || 0) / 1000));
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (isProduction) cookieParts.push('Secure');
  return cookieParts.join('; ');
}

function setSessionCookie(res, sessionId, maxAgeMs) {
  res.setHeader('Set-Cookie', buildSetCookieValue(sessionId, maxAgeMs));
}

function clearSessionCookie(res) {
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProduction) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

async function authenticateUser(id, password) {
  const normalizedId = String(id || '').trim();
  const plainPassword = String(password || '');
  if (!normalizedId || !plainPassword) return { success: false, reason: 'invalid_credentials' };

  const usersDoc = await readUsersDocument();
  const user = usersDoc.users.find((entry) => String(entry?.id || '') === normalizedId);
  if (!user || user.active === false) {
    return { success: false, reason: 'invalid_credentials' };
  }
  const ok = verifyPassword(plainPassword, String(user.passwordHash || ''));
  if (!ok) {
    return { success: false, reason: 'invalid_credentials' };
  }
  return {
    success: true,
    user: {
      id: normalizedId,
      name: String(user.name || normalizedId),
      role: user.role || 'user',
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  };
}

module.exports = {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  createSession,
  invalidateSession,
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  authenticateUser,
  resolveUsersFilePath,
};
