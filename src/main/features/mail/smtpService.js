const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { get, del } = require('@vercel/blob');

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const buildFromHeader = (name, email) => {
  const address = sanitizeString(email);
  if (!address) return '';
  const display = sanitizeString(name).replace(/"/g, "'");
  return display ? `"${display}" <${address}>` : address;
};

const normalizePort = (value, fallback = 465) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
};

const resolveBlobToken = () => process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN || '';

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  const response = new Response(stream);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function resolveBlobAttachment(item) {
  const pathname = sanitizeString(item.blobPathname || item.pathname);
  if (!pathname) return null;
  const token = resolveBlobToken();
  if (!token) throw new Error('Blob 토큰이 설정되지 않아 첨부를 읽을 수 없습니다.');
  const result = await get(pathname, { access: 'private', token, useCache: false });
  if (!result || result.statusCode !== 200) {
    throw new Error(`첨부를 읽을 수 없습니다: ${pathname}`);
  }
  const content = await streamToBuffer(result.stream);
  return {
    filename: item.filename || path.basename(pathname),
    content,
    contentType: item.contentType || undefined,
  };
}

function collectBlobAttachmentPaths(messages = []) {
  const paths = new Set();
  messages.forEach((message) => {
    (message?.attachments || []).forEach((attachment) => {
      const pathname = sanitizeString(attachment?.blobPathname || attachment?.pathname);
      if (pathname) paths.add(pathname);
    });
  });
  return Array.from(paths);
}

async function cleanupBlobAttachments(pathnames = []) {
  const token = resolveBlobToken();
  if (!token || !Array.isArray(pathnames) || pathnames.length === 0) return;
  await Promise.all(pathnames.map(async (pathname) => {
    try {
      await del(pathname, { token });
    } catch (error) {
      console.warn('[mail] failed to delete temp attachment:', pathname, error?.message || error);
    }
  }));
}

const createTransporter = (connection = {}) => {
  const auth = connection.auth || {};
  const host = sanitizeString(connection.host);
  const username = sanitizeString(auth.user || auth.username);
  const password = typeof auth.pass === 'string' ? auth.pass : (typeof auth.password === 'string' ? auth.password : '');
  if (!host) throw new Error('SMTP 호스트를 입력해 주세요.');
  if (!username || !password) throw new Error('SMTP 계정 또는 비밀번호가 비어 있습니다.');
  const port = normalizePort(connection.port, connection.secure ? 465 : 587);
  const secure = Boolean(connection.secure);
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: username, pass: password },
    tls: {
      rejectUnauthorized: connection.rejectUnauthorized !== false,
    },
  });
};

const sanitizeAttachments = async (attachments = []) => {
  const resolved = await Promise.all(attachments.map(async (item) => {
    if (!item) return null;
    if (item.path) {
      const resolved = sanitizeString(item.path);
      if (!resolved) return null;
      try {
        if (!fs.existsSync(resolved)) return null;
      } catch {
        return null;
      }
      return {
        filename: item.filename || path.basename(resolved),
        path: resolved,
      };
    }
    if (item.blobPathname || item.pathname) {
      return resolveBlobAttachment(item);
    }
    if (item.content && item.filename) {
      return {
        filename: item.filename,
        content: item.content,
      };
    }
    if (item.contentBase64 && item.filename) {
      try {
        const buffer = Buffer.from(String(item.contentBase64), 'base64');
        return {
          filename: item.filename,
          content: buffer,
          contentType: item.contentType || undefined,
        };
      } catch {
        return null;
      }
    }
    return null;
  }));
  return resolved.filter(Boolean);
};

const sendWithTransporter = async (transporter, message = {}) => {
  const fromAddress = sanitizeString(message.from);
  const toAddress = sanitizeString(message.to || fromAddress);
  if (!fromAddress) throw new Error('발신 이메일 주소를 입력해 주세요.');
  if (!toAddress) throw new Error('수신 이메일 주소를 입력해 주세요.');
  const payload = {
    from: buildFromHeader(message.fromName, fromAddress),
    to: toAddress,
    replyTo: sanitizeString(message.replyTo) || undefined,
    subject: message.subject ? String(message.subject) : '[알림] 메일이 도착했습니다.',
    text: message.text ? String(message.text) : '',
    html: message.html ? String(message.html) : undefined,
  };
  const attachments = await sanitizeAttachments(message.attachments);
  if (attachments.length) {
    payload.attachments = attachments;
  }
  return transporter.sendMail(payload);
};

async function sendTestMail(payload = {}) {
  const transporter = createTransporter(payload.connection || {});
  try {
    const info = await sendWithTransporter(transporter, {
      subject: payload.message?.subject || '[테스트] SMTP 연결 확인',
      text: payload.message?.text || '이 메일은 SMTP 연결 테스트용으로 발송되었습니다.',
      ...payload.message,
    });
    return {
      success: true,
      messageId: info?.messageId || null,
      accepted: Array.isArray(info?.accepted) ? info.accepted : [],
      response: info?.response || '',
    };
  } finally {
    try { await transporter.close?.(); } catch {}
  }
}

async function sendBulkMail(payload = {}) {
  const { connection, messages = [], delayMs = 0, onProgress } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('발송할 메시지가 없습니다.');
  }
  const transporter = createTransporter(connection || {});
  const results = [];
  const tempBlobAttachments = collectBlobAttachmentPaths(messages);
  try {
    let processed = 0;
    for (const message of messages) {
      try {
        const info = await sendWithTransporter(transporter, message);
        results.push({
          success: true,
          to: message.to,
          recipientId: message.recipientId ?? null,
          messageId: info?.messageId || null,
        });
      } catch (err) {
        results.push({
          success: false,
          to: message.to,
          recipientId: message.recipientId ?? null,
          error: err?.message || '발송 실패',
        });
      }
      processed += 1;
      if (typeof onProgress === 'function') {
        try { onProgress(processed); } catch {}
      }
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  } finally {
    try { await transporter.close?.(); } catch {}
    await cleanupBlobAttachments(tempBlobAttachments);
  }
  return results;
}

module.exports = {
  sendTestMail,
  sendBulkMail,
};
