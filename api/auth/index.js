const { sendJson, allowMethods, readJsonBody } = require('../_lib/http');
const {
  SESSION_TTL_MS,
  createSession,
  invalidateSession,
  getSessionFromRequest,
  setSessionCookie,
  clearSessionCookie,
  authenticateUser,
} = require('../_lib/auth-store');

function getAction(req) {
  const url = new URL(req.url, 'http://localhost');
  return String(url.searchParams.get('action') || '').trim().toLowerCase();
}

module.exports = async function handler(req, res) {
  const action = getAction(req);

  if (req.method === 'GET') {
    if (action === 'session' || !action) {
      const session = getSessionFromRequest(req);
      if (!session) {
        return sendJson(res, 200, {
          success: true,
          authenticated: false,
          sessionTtlMs: SESSION_TTL_MS,
        });
      }
      return sendJson(res, 200, {
        success: true,
        authenticated: true,
        user: session.user || null,
        sessionExpiresAt: session.expiresAt,
        sessionTtlMs: SESSION_TTL_MS,
      });
    }

    allowMethods(res, ['GET', 'POST']);
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  if (req.method === 'POST') {
    if (action === 'login') {
      try {
        const body = await readJsonBody(req);
        const id = body?.id;
        const password = body?.password;
        const result = await authenticateUser(id, password);
        if (!result.success) {
          return sendJson(res, 401, { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        const session = createSession(result.user);
        setSessionCookie(res, session.sessionId, session.maxAgeMs);
        return sendJson(res, 200, {
          success: true,
          authenticated: true,
          user: result.user,
          sessionExpiresAt: Date.now() + session.maxAgeMs,
          sessionTtlMs: SESSION_TTL_MS,
        });
      } catch (error) {
        console.error('[api/auth:login] failed:', error);
        return sendJson(res, 500, { success: false, message: error?.message || 'Login failed' });
      }
    }

    if (action === 'logout') {
      const session = getSessionFromRequest(req);
      if (session) {
        invalidateSession(session.sessionId);
      }
      clearSessionCookie(res);
      return sendJson(res, 200, { success: true, authenticated: false });
    }

    allowMethods(res, ['GET', 'POST']);
    return sendJson(res, 400, { success: false, message: 'Invalid action' });
  }

  allowMethods(res, ['GET', 'POST']);
  return sendJson(res, 405, { success: false, message: 'Method not allowed' });
};
