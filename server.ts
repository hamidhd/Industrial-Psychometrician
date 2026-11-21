import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'),
) as { version: string };

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8'),
) as { apiKey?: string; projectId?: string };

const PORT = Number(process.env.PORT || 3000);
const SESSION_TTL_MS = 5 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AuthBridgeSession {
  id: string;
  readSecretHash: Buffer;
  writeSecretHash: Buffer;
  status: 'pending' | 'completed' | 'error';
  googleIdToken?: string;
  googleAccessToken?: string;
  email?: string;
  displayName?: string;
  error?: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, AuthBridgeSession>();

function sha256(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function constantTimeMatch(secret: string, expectedHash: Buffer): boolean {
  if (!secret || typeof secret !== 'string' || secret.length > 256) return false;
  const candidate = sha256(secret);
  if (candidate.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(candidate, expectedHash);
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(id);
    }
  }
}

setInterval(pruneExpiredSessions, 60_000).unref();

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return '';
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

function isAllowedOrigin(origin: string, req: Request): boolean {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();

    // Tauri desktop & mobile WebView origins + local dev
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'tauri.localhost' ||
      origin === 'tauri://localhost'
    ) {
      return true;
    }

    // Same-host HTTPS/HTTP origin
    const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
      .toString()
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (reqHost && (parsed.host.toLowerCase() === reqHost || host === reqHost.split(':')[0])) {
      return true;
    }

    // Cloud Run / AI Studio preview & deployed origins
    if (parsed.protocol === 'https:' && host.endsWith('.run.app')) {
      return true;
    }

    // Explicit allowlist from environment
    const extra = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (extra.includes(origin)) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function cleanShortString(value: unknown, maxLen: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return undefined;
  return trimmed;
}

async function verifyFirebaseIdTokenWithApi(
  idToken: string,
): Promise<{ email?: string; displayName?: string; emailVerified?: boolean } | null> {
  if (!firebaseConfig.apiKey) return null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      users?: Array<{ email?: string; displayName?: string; emailVerified?: boolean }>;
    };
    const user = data.users?.[0];
    if (!user) return null;
    return {
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
    };
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use('/api', express.json({ limit: '64kb' }));

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    if (origin && isAllowedOrigin(origin, req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'ravansanj-sanati-backend',
      authBridge: true,
      version: pkg.version,
      timestamp: Date.now(),
    });
  });

  app.post('/api/auth/session', (_req: Request, res: Response) => {
    pruneExpiredSessions();
    if (sessions.size >= MAX_ACTIVE_SESSIONS) {
      res.status(429).json({ error: 'تعداد نشست‌های فعال موقتاً زیاد است؛ لحظاتی بعد تلاش کنید.' });
      return;
    }

    const sessionId = crypto.randomUUID();
    const readSecret = crypto.randomBytes(32).toString('hex');
    const writeSecret = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + SESSION_TTL_MS;

    sessions.set(sessionId, {
      id: sessionId,
      readSecretHash: sha256(readSecret),
      writeSecretHash: sha256(writeSecret),
      status: 'pending',
      createdAt: now,
      expiresAt,
    });

    res.status(201).json({
      sessionId,
      readSecret,
      writeSecret,
      expiresAt,
    });
  });

  app.post('/api/auth/session/:sessionId/complete', async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
      res.status(400).json({ error: 'شناسه نشست نامعتبر است.' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'نشست احراز هویت یافت نشد یا منقضی شده است.' });
      return;
    }
    if (session.expiresAt <= Date.now()) {
      sessions.delete(sessionId);
      res.status(410).json({ error: 'مهلت نشست احراز هویت به پایان رسیده است.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const writeSecret =
      cleanShortString(body.writeSecret, 256) || extractBearerToken(req);

    if (!writeSecret || !constantTimeMatch(writeSecret, session.writeSecretHash)) {
      res.status(401).json({ error: 'توکن تکمیل نشست نامعتبر است.' });
      return;
    }

    const errText = cleanShortString(body.error, 300);
    if (errText) {
      session.status = 'error';
      session.error = errText;
      res.json({ ok: true, status: 'error' });
      return;
    }

    const googleIdToken = cleanShortString(body.googleIdToken, 8192);
    const googleAccessToken = cleanShortString(body.googleAccessToken, 8192);
    const firebaseIdToken = cleanShortString(body.firebaseIdToken, 8192);

    if (!googleIdToken && !googleAccessToken) {
      res.status(400).json({ error: 'توکن گوگل ارسال نشده است.' });
      return;
    }

    let verifiedEmail = cleanShortString(body.email, 200);
    let verifiedName = cleanShortString(body.displayName, 200);

    if (firebaseIdToken) {
      const lookedUp = await verifyFirebaseIdTokenWithApi(firebaseIdToken);
      if (!lookedUp) {
        res.status(401).json({ error: 'اعتبارسنجی نشست Firebase تایید نشد.' });
        return;
      }
      if (lookedUp.email) verifiedEmail = lookedUp.email;
      if (lookedUp.displayName) verifiedName = lookedUp.displayName;
    }

    session.status = 'completed';
    session.googleIdToken = googleIdToken;
    session.googleAccessToken = googleAccessToken;
    session.email = verifiedEmail;
    session.displayName = verifiedName;

    res.json({ ok: true, status: 'completed' });
  });

  app.get('/api/auth/session/:sessionId', (req: Request, res: Response) => {
    const { sessionId } = req.params;
    if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
      res.status(400).json({ error: 'شناسه نشست نامعتبر است.' });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ error: 'نشست یافت نشد یا قبلاً استفاده شده است.' });
      return;
    }
    if (session.expiresAt <= Date.now()) {
      sessions.delete(sessionId);
      res.status(410).json({ status: 'expired', error: 'زمان نشست به پایان رسید.' });
      return;
    }

    const readSecret = extractBearerToken(req);
    if (!readSecret || !constantTimeMatch(readSecret, session.readSecretHash)) {
      res.status(401).json({ error: 'دسترسی غیرمجاز به نشست.' });
      return;
    }

    if (session.status === 'pending') {
      res.json({ status: 'pending', expiresAt: session.expiresAt });
      return;
    }

    if (session.status === 'error') {
      const errorMsg = session.error || 'خطا در احراز هویت گوگل';
      sessions.delete(sessionId);
      res.json({ status: 'error', error: errorMsg });
      return;
    }

    const payload = {
      status: 'completed',
      googleIdToken: session.googleIdToken,
      googleAccessToken: session.googleAccessToken,
      email: session.email,
      displayName: session.displayName,
    };
    sessions.delete(sessionId);
    res.json(payload);
  });

  app.post('/api/auth/verify', async (req: Request, res: Response) => {
    const idToken =
      cleanShortString((req.body as Record<string, unknown> | undefined)?.idToken, 8192) ||
      extractBearerToken(req);
    if (!idToken) {
      res.status(400).json({ error: 'توکن ارسال نشده است.' });
      return;
    }
    const lookedUp = await verifyFirebaseIdTokenWithApi(idToken);
    if (!lookedUp) {
      res.status(401).json({ valid: false });
      return;
    }
    res.json({
      valid: true,
      email: lookedUp.email,
      displayName: lookedUp.displayName,
      emailVerified: Boolean(lookedUp.emailVerified),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Ravansanj Sanati server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
