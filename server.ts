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

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || '.data');
const STORE_PATH = path.join(DATA_DIR, 'ravansanj-data.json');
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_SESSIONS = 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 10;

interface StoredAuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'evaluator';
  dept: string;
  personnelId: string;
  nationalCode: string;
  passwordHash: string; // scrypt: salt:hash
  createdAt: number;
}

interface StoredWorkspace {
  id: string;
  org: string;
  examiner: string;
  ownerId: string;
  ownerEmail: string;
  allowedEmails: string[];
}

interface StoredPerson {
  id: string;
  workspaceId: string;
  ownerId: string;
  allowedEmails: string[];
  name: string;
  code: string;
  kind: 'candidate' | 'employee';
  dept: string;
  job: string;
  age: string;
  consent: boolean;
  created: number;
  createdByUid: string;
  createdByEmail: string;
}

interface StoredResult {
  id: string;
  workspaceId: string;
  personId: string;
  ownerId: string;
  allowedEmails: string[];
  testId: string;
  date: number;
  computerLabel: string;
  recordedByUid: string;
  recordedByEmail: string;
  examiner: string;
  answers?: number[];
  taskMetrics?: Record<string, unknown>;
  dims: unknown[];
  flags: unknown[];
}

interface ServerStore {
  users: StoredAuthUser[];
  workspaces: StoredWorkspace[];
  people: StoredPerson[];
  results: StoredResult[];
}

interface SessionUser {
  id: string;
  personnelId: string;
  name: string;
  nationalCode: string;
  mobile: string;
  dept: string;
  hireDate: string;
  role: 'admin' | 'evaluator' | 'employee';
  username?: string;
  hasResultAccess: boolean;
  isEnvAdmin?: boolean;
}

interface ActiveSession {
  tokenHash: string;
  user: SessionUser;
  expiresAt: number;
}

interface AuthedRequest extends Request {
  session?: ActiveSession;
}

const VALID_TEST_IDS = new Set([
  'riasec',
  'ipip',
  'dass',
  'safety',
  'integrity',
  'burnout',
  'fatigue',
  'reaction',
  'stroop',
  'digits',
  'trail',
]);

const sessions = new Map<string, ActiveSession>();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function ensureStoreDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function defaultWorkspace(): StoredWorkspace {
  return {
    id: 'ws_internal_default',
    org: 'سازمان من — واحد ارزیابی و منابع انسانی',
    examiner: 'واحد ایمنی و بهداشت (HSE) / منابع انسانی',
    ownerId: 'internal_admin',
    ownerEmail: 'admin@internal.local',
    allowedEmails: ['admin@internal.local'],
  };
}

function readStore(): ServerStore {
  ensureStoreDir();
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<ServerStore>;
      const workspaces =
        Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0
          ? parsed.workspaces
          : [defaultWorkspace()];
      return {
        users: Array.isArray(parsed.users) ? parsed.users : [],
        workspaces,
        people: Array.isArray(parsed.people) ? parsed.people : [],
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
    }
  } catch {
    // recreate cleanly if unreadable
  }
  const initial: ServerStore = {
    users: [],
    workspaces: [defaultWorkspace()],
    people: [],
    results: [],
  };
  writeStore(initial);
  return initial;
}

function writeStore(store: ServerStore) {
  ensureStoreDir();
  const tmpPath = `${STORE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, STORE_PATH);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function constantTimeStringMatch(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function getEnvAdminPasscode(): string {
  return (process.env.ADMIN_PASSCODE || '').trim();
}

function getEnvAdminUsername(): string {
  return (process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';
}

function makeSafeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function cleanStr(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function pruneSessions() {
  const now = Date.now();
  for (const [key, sess] of sessions.entries()) {
    if (sess.expiresAt <= now) {
      sessions.delete(key);
    }
  }
  for (const [ip, rec] of loginAttempts.entries()) {
    if (rec.resetAt <= now) {
      loginAttempts.delete(ip);
    }
  }
}

setInterval(pruneSessions, 60_000).unref();

function issueSession(user: SessionUser): string {
  pruneSessions();
  if (sessions.size >= MAX_SESSIONS) {
    const oldestKey = sessions.keys().next().value;
    if (oldestKey) sessions.delete(oldestKey);
  }
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(token);
  sessions.set(tokenHash, {
    tokenHash,
    user,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

function extractBearerToken(req: Request): string {
  const hdr = req.headers.authorization;
  if (!hdr || typeof hdr !== 'string' || !hdr.startsWith('Bearer ')) return '';
  return hdr.slice(7).trim();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'احراز هویت انجام نشده است.' });
    return;
  }
  const sess = sessions.get(sha256Hex(token));
  if (!sess || sess.expiresAt <= Date.now()) {
    if (sess) sessions.delete(sess.tokenHash);
    res.status(401).json({ error: 'نشست کاربری منقضی یا نامعتبر است.' });
    return;
  }
  req.session = sess;
  next();
}

function requirePrivileged(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const user = req.session?.user;
    if (!user || !user.hasResultAccess || (user.role !== 'admin' && user.role !== 'evaluator')) {
      res.status(403).json({ error: 'دسترسی به اطلاعات محرمانه فقط برای مدیران و ارزیابان مجاز است.' });
      return;
    }
    next();
  });
}

function requireAdminOnly(req: AuthedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    const user = req.session?.user;
    if (!user || !user.hasResultAccess || user.role !== 'admin') {
      res.status(403).json({ error: 'این عملیات فقط توسط مدیر ارشد سیستم مجاز است.' });
      return;
    }
    next();
  });
}

function isAllowedOrigin(origin: string, req: Request): boolean {
  try {
    const parsed = new URL(origin);
    const host = parsed.hostname.toLowerCase();

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'tauri.localhost' ||
      origin === 'tauri://localhost'
    ) {
      return true;
    }

    const reqHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
      .toString()
      .split(',')[0]
      .trim()
      .toLowerCase();
    if (reqHost && (parsed.host.toLowerCase() === reqHost || host === reqHost.split(':')[0])) {
      return true;
    }

    if (parsed.protocol === 'https:' && host.endsWith('.run.app')) {
      return true;
    }

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

function getClientIp(req: Request): string {
  const fwd = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  return fwd || req.ip || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (rec.resetAt <= Date.now()) {
    loginAttempts.delete(ip);
    return false;
  }
  return rec.count >= MAX_LOGIN_FAILURES;
}

function recordLoginFailure(ip: string) {
  const now = Date.now();
  const existing = loginAttempts.get(ip);
  if (!existing || existing.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    existing.count += 1;
  }
}

function clearLoginFailures(ip: string) {
  loginAttempts.delete(ip);
}

function employeeMatchesPerson(user: SessionUser, person: StoredPerson): boolean {
  const userCodes = new Set(
    [user.personnelId, user.nationalCode]
      .map((c) => c.trim())
      .filter((c) => c && c !== '0000000000' && c !== '99999')
  );
  if (person.createdByUid === user.id) return true;
  if (person.code && userCodes.has(person.code.trim())) return true;
  return false;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use('/api', express.json({ limit: '1mb' }));

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    if (origin && isAllowedOrigin(origin, req)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      service: 'ravansanj-sanati-internal-backend',
      version: pkg.version,
      timestamp: Date.now(),
    });
  });

  app.get('/api/auth/status', (_req: Request, res: Response) => {
    const store = readStore();
    const envConfigured = Boolean(getEnvAdminPasscode());
    const hasStoredAdmin = store.users.some((u) => u.role === 'admin');
    res.json({
      ok: true,
      adminClaimed: envConfigured || hasStoredAdmin,
      envAdminConfigured: envConfigured,
      version: pkg.version,
    });
  });

  app.post('/api/auth/bootstrap-admin', (req: Request, res: Response) => {
    const envPass = getEnvAdminPasscode();
    const store = readStore();
    const hasStoredAdmin = store.users.some((u) => u.role === 'admin');

    if (envPass || hasStoredAdmin) {
      res.status(409).json({ error: 'حساب مدیر ارشد قبلاً راه‌اندازی شده است.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const username = cleanStr(body.username, 64);
    const password = typeof body.password === 'string' ? body.password : '';
    const name = cleanStr(body.name, 120) || 'مدیر ارشد سیستم';

    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) {
      res.status(400).json({ error: 'نام کاربری باید حداقل ۳ کاراکتر انگلیسی/عدد باشد.' });
      return;
    }
    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'رمز عبور مدیر ارشد باید حداقل ۸ کاراکتر باشد.' });
      return;
    }

    const newAdmin: StoredAuthUser = {
      id: makeSafeId('adm'),
      username,
      name,
      role: 'admin',
      dept: 'ایمنی و بهداشت / مدیریت',
      personnelId: '1001',
      nationalCode: '',
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    };

    store.users.push(newAdmin);
    writeStore(store);

    const sessionUser: SessionUser = {
      id: newAdmin.id,
      personnelId: newAdmin.personnelId,
      name: newAdmin.name,
      nationalCode: '',
      mobile: '',
      dept: newAdmin.dept,
      hireDate: '',
      role: 'admin',
      username: newAdmin.username,
      hasResultAccess: true,
    };
    const token = issueSession(sessionUser);
    res.status(201).json({ token, user: sessionUser });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      res.status(429).json({
        error: 'تعداد تلاش‌های ناموفق بیش از حد مجاز است؛ لطفاً ۱۵ دقیقه بعد دوباره تلاش کنید.',
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const username = cleanStr(body.username, 64);
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است.' });
      return;
    }

    const envPass = getEnvAdminPasscode();
    const envUser = getEnvAdminUsername();

    // 1. Check configured environment admin override
    if (envPass && username === envUser && constantTimeStringMatch(password, envPass)) {
      clearLoginFailures(ip);
      const sessionUser: SessionUser = {
        id: 'env_admin',
        personnelId: '1001',
        name: 'مدیر ارشد سیستم',
        nationalCode: '',
        mobile: '',
        dept: 'مدیریت سیستم',
        hireDate: '',
        role: 'admin',
        username: envUser,
        hasResultAccess: true,
        isEnvAdmin: true,
      };
      const token = issueSession(sessionUser);
      res.json({ token, user: sessionUser });
      return;
    }

    // 2. Check scrypt-hashed stored privileged accounts (admin/evaluator ONLY)
    const store = readStore();
    const matched = store.users.find(
      (u) => (u.role === 'admin' || u.role === 'evaluator') && u.username === username
    );

    if (!matched || !verifyPassword(password, matched.passwordHash)) {
      recordLoginFailure(ip);
      res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
      return;
    }

    clearLoginFailures(ip);
    const sessionUser: SessionUser = {
      id: matched.id,
      personnelId: matched.personnelId,
      name: matched.name,
      nationalCode: matched.nationalCode,
      mobile: '',
      dept: matched.dept,
      hireDate: '',
      role: matched.role,
      username: matched.username,
      hasResultAccess: true,
    };
    const token = issueSession(sessionUser);
    res.json({ token, user: sessionUser });
  });

  app.post('/api/auth/personnel-login', (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const identifier = cleanStr(body.identifier, 64);

    if (!identifier) {
      res.status(400).json({ error: 'کد ملی یا کد پرسنلی را وارد کنید.' });
      return;
    }

    const store = readStore();
    const envUser = getEnvAdminUsername();

    // Block impersonation or password bypass of any privileged account from personnel login
    const conflictsPrivileged =
      identifier === envUser ||
      store.users.some(
        (u) =>
          u.username === identifier ||
          (u.personnelId && u.personnelId === identifier) ||
          (u.nationalCode && u.nationalCode === identifier)
      );

    if (conflictsPrivileged) {
      res.status(403).json({
        error: 'این شناسه متعلق به حساب مدیریتی یا ارزیاب است؛ لطفاً از بخش مدیران با رمز عبور وارد شوید.',
      });
      return;
    }

    const matchedPerson = store.people.find(
      (p) => p.code && p.code.trim() === identifier
    );

    const sessionUser: SessionUser = {
      id: `emp_${sha256Hex(identifier).slice(0, 16)}`,
      personnelId: matchedPerson ? matchedPerson.code : identifier,
      name: matchedPerson ? matchedPerson.name : 'پرسنل گرامی',
      nationalCode: /^\d{10}$/.test(identifier) ? identifier : '0000000000',
      mobile: '',
      dept: matchedPerson?.dept || 'عمومی',
      hireDate: '',
      role: 'employee',
      hasResultAccess: false,
    };

    const token = issueSession(sessionUser);
    res.json({ token, user: sessionUser });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (token) {
      sessions.delete(sha256Hex(token));
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res: Response) => {
    res.json({ user: req.session!.user });
  });

  app.post('/api/auth/change-password', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const user = req.session!.user;
    if (user.isEnvAdmin || user.id === 'env_admin') {
      res.status(400).json({
        error: 'رمز مدیر محیطی از طریق متغیر ADMIN_PASSCODE در تنظیمات سرور مدیریت می‌شود.',
      });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) {
      res.status(400).json({ error: 'رمز عبور فعلی و رمز جدید (حداقل ۸ کاراکتر) را وارد کنید.' });
      return;
    }

    const store = readStore();
    const idx = store.users.findIndex((u) => u.id === user.id);
    if (idx === -1 || !verifyPassword(currentPassword, store.users[idx].passwordHash)) {
      res.status(401).json({ error: 'رمز عبور فعلی نادرست است.' });
      return;
    }

    store.users[idx].passwordHash = hashPassword(newPassword);
    writeStore(store);
    res.json({ ok: true });
  });

  app.get('/api/auth/users', requireAdminOnly, (_req: AuthedRequest, res: Response) => {
    const store = readStore();
    const safeUsers = store.users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      dept: u.dept,
      createdAt: u.createdAt,
    }));
    res.json({ users: safeUsers });
  });

  app.post('/api/auth/users', requireAdminOnly, (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const username = cleanStr(body.username, 64);
    const name = cleanStr(body.name, 120);
    const dept = cleanStr(body.dept, 100) || 'ایمنی و بهداشت';
    const role = body.role === 'admin' ? 'admin' : 'evaluator';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) {
      res.status(400).json({ error: 'نام کاربری باید حداقل ۳ کاراکتر انگلیسی یا عدد باشد.' });
      return;
    }
    if (!name || password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'نام کامل و رمز عبور (حداقل ۸ کاراکتر) را وارد کنید.' });
      return;
    }

    const store = readStore();
    if (
      username === getEnvAdminUsername() ||
      store.users.some((u) => u.username.toLowerCase() === username.toLowerCase())
    ) {
      res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده است.' });
      return;
    }

    const created: StoredAuthUser = {
      id: makeSafeId('usr'),
      username,
      name,
      role,
      dept,
      personnelId: '',
      nationalCode: '',
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    };
    store.users.push(created);
    writeStore(store);
    res.status(201).json({
      user: {
        id: created.id,
        username: created.username,
        name: created.name,
        role: created.role,
        dept: created.dept,
        createdAt: created.createdAt,
      },
    });
  });

  app.delete('/api/auth/users/:userId', requireAdminOnly, (req: AuthedRequest, res: Response) => {
    const targetId = cleanStr(req.params.userId, 128);
    if (targetId === req.session!.user.id) {
      res.status(400).json({ error: 'امکان حذف حساب کاربری فعال خودتان وجود ندارد.' });
      return;
    }
    const store = readStore();
    const target = store.users.find((u) => u.id === targetId);
    if (!target) {
      res.status(404).json({ error: 'کاربر یافت نشد.' });
      return;
    }
    if (target.role === 'admin') {
      const adminCount = store.users.filter((u) => u.role === 'admin').length;
      if (adminCount <= 1 && !getEnvAdminPasscode()) {
        res.status(400).json({ error: 'حداقل یک حساب مدیر ارشد باید در سامانه باقی بماند.' });
        return;
      }
    }
    store.users = store.users.filter((u) => u.id !== targetId);
    writeStore(store);

    // Revoke active sessions of deleted user
    for (const [k, s] of sessions.entries()) {
      if (s.user.id === targetId) {
        sessions.delete(k);
      }
    }
    res.json({ ok: true });
  });

  // --- Protected Workspaces & Confidential Personnel/Results Routes ---

  app.get('/api/workspaces', requireAuth, (_req: AuthedRequest, res: Response) => {
    const store = readStore();
    res.json({ workspaces: store.workspaces });
  });

  app.post('/api/workspaces', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const org = cleanStr(body.org, 120);
    const examiner = cleanStr(body.examiner, 120) || req.session!.user.name;
    if (!org) {
      res.status(400).json({ error: 'نام سازمان الزامی است.' });
      return;
    }
    const store = readStore();
    const id = makeSafeId('ws');
    store.workspaces.push({
      id,
      org,
      examiner,
      ownerId: req.session!.user.id,
      ownerEmail: `${req.session!.user.username || 'admin'}@internal.local`,
      allowedEmails: [`${req.session!.user.username || 'admin'}@internal.local`],
    });
    writeStore(store);
    res.status(201).json({ id });
  });

  app.put('/api/workspaces/:wsId/meta', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const body = (req.body || {}) as Record<string, unknown>;
    const org = cleanStr(body.org, 120);
    const examiner = cleanStr(body.examiner, 120);
    const store = readStore();
    const idx = store.workspaces.findIndex((w) => w.id === wsId);
    if (idx === -1) {
      res.status(404).json({ error: 'پایگاه داده یافت نشد.' });
      return;
    }
    store.workspaces[idx] = {
      ...store.workspaces[idx],
      org: org || store.workspaces[idx].org,
      examiner: examiner || store.workspaces[idx].examiner,
    };
    writeStore(store);
    res.json({ ok: true });
  });

  app.get('/api/workspaces/:wsId/data', requireAuth, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const user = req.session!.user;
    const store = readStore();

    const wsPeople = store.people.filter((p) => p.workspaceId === wsId);
    const wsResults = store.results.filter((r) => r.workspaceId === wsId);

    if (user.hasResultAccess && (user.role === 'admin' || user.role === 'evaluator')) {
      res.json({
        people: [...wsPeople].sort((a, b) => b.created - a.created),
        results: [...wsResults].sort((a, b) => b.date - a.date),
      });
      return;
    }

    // Strict privacy isolation: employees ONLY receive their own profile and own results
    const ownPeople = wsPeople.filter((p) => employeeMatchesPerson(user, p));
    const ownIds = new Set(ownPeople.map((p) => p.id));
    const ownResults = wsResults
      .filter((r) => ownIds.has(r.personId))
      .sort((a, b) => b.date - a.date);

    res.json({ people: ownPeople, results: ownResults });
  });

  app.post('/api/workspaces/:wsId/people', requireAuth, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const user = req.session!.user;
    const store = readStore();
    const ws = store.workspaces.find((w) => w.id === wsId);
    if (!ws) {
      res.status(404).json({ error: 'پایگاه داده یافت نشد.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const name = cleanStr(body.name, 120);
    if (!name) {
      res.status(400).json({ error: 'نام فرد الزامی است.' });
      return;
    }
    const code = cleanStr(body.code, 40);

    // Employees may only create their own single profile
    if (!user.hasResultAccess) {
      const existingOwn = store.people.find(
        (p) => p.workspaceId === wsId && employeeMatchesPerson(user, p)
      );
      if (existingOwn) {
        res.json({ id: existingOwn.id });
        return;
      }
      if (code && code !== user.personnelId && code !== user.nationalCode) {
        res.status(403).json({ error: 'امکان ثبت پرونده برای کد پرسنلی دیگر وجود ندارد.' });
        return;
      }
    }

    const id = makeSafeId('p');
    const person: StoredPerson = {
      id,
      workspaceId: wsId,
      ownerId: ws.ownerId,
      allowedEmails: ws.allowedEmails,
      name,
      code,
      kind: user.hasResultAccess && body.kind === 'candidate' ? 'candidate' : 'employee',
      dept: cleanStr(body.dept, 100),
      job: cleanStr(body.job, 100),
      age: cleanStr(body.age, 10),
      consent: Boolean(body.consent ?? true),
      created: Date.now(),
      createdByUid: user.id,
      createdByEmail: `${user.username || user.personnelId}@internal.local`,
    };
    store.people.push(person);
    writeStore(store);
    res.status(201).json({ id });
  });

  app.post('/api/workspaces/:wsId/people/batch', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const store = readStore();
    const ws = store.workspaces.find((w) => w.id === wsId);
    if (!ws) {
      res.status(404).json({ error: 'پایگاه داده یافت نشد.' });
      return;
    }
    const items = Array.isArray((req.body as { items?: unknown[] })?.items)
      ? ((req.body as { items: unknown[] }).items)
      : [];
    const existingCodes = new Set(
      store.people.filter((p) => p.workspaceId === wsId && p.code).map((p) => p.code.trim())
    );
    let added = 0;
    const baseTs = Date.now();
    for (let i = 0; i < items.length && i < 2000; i++) {
      const it = (items[i] || {}) as Record<string, unknown>;
      const name = cleanStr(it.name, 120);
      if (!name) continue;
      const code = cleanStr(it.code, 40);
      if (code && existingCodes.has(code)) continue;
      if (code) existingCodes.add(code);
      store.people.push({
        id: `${makeSafeId('p')}_${i}`,
        workspaceId: wsId,
        ownerId: ws.ownerId,
        allowedEmails: ws.allowedEmails,
        name,
        code,
        kind: it.kind === 'candidate' ? 'candidate' : 'employee',
        dept: cleanStr(it.dept, 100),
        job: cleanStr(it.job, 100),
        age: cleanStr(it.age, 10),
        consent: true,
        created: baseTs - i,
        createdByUid: req.session!.user.id,
        createdByEmail: `${req.session!.user.username || 'admin'}@internal.local`,
      });
      added++;
    }
    if (added > 0) writeStore(store);
    res.json({ added });
  });

  app.put('/api/workspaces/:wsId/people/:personId', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const personId = cleanStr(req.params.personId, 128);
    const body = (req.body || {}) as Record<string, unknown>;
    const store = readStore();
    const idx = store.people.findIndex((p) => p.workspaceId === wsId && p.id === personId);
    if (idx === -1) {
      res.status(404).json({ error: 'پرونده یافت نشد.' });
      return;
    }
    store.people[idx] = {
      ...store.people[idx],
      name: cleanStr(body.name, 120) || store.people[idx].name,
      code: cleanStr(body.code, 40),
      kind: body.kind === 'employee' ? 'employee' : 'candidate',
      dept: cleanStr(body.dept, 100),
      job: cleanStr(body.job, 100),
      age: cleanStr(body.age, 10),
    };
    writeStore(store);
    res.json({ ok: true });
  });

  app.delete('/api/workspaces/:wsId/people/:personId', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const personId = cleanStr(req.params.personId, 128);
    const store = readStore();
    store.people = store.people.filter((p) => !(p.workspaceId === wsId && p.id === personId));
    store.results = store.results.filter((r) => !(r.workspaceId === wsId && r.personId === personId));
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/workspaces/:wsId/results', requireAuth, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const user = req.session!.user;
    const store = readStore();
    const ws = store.workspaces.find((w) => w.id === wsId);
    if (!ws) {
      res.status(404).json({ error: 'پایگاه داده یافت نشد.' });
      return;
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const personId = cleanStr(body.personId, 128);
    const testId = cleanStr(body.testId, 32);
    if (!VALID_TEST_IDS.has(testId)) {
      res.status(400).json({ error: 'شناسه آزمون نامعتبر است.' });
      return;
    }

    const person = store.people.find((p) => p.workspaceId === wsId && p.id === personId);
    if (!person) {
      res.status(404).json({ error: 'پرونده فرد یافت نشد.' });
      return;
    }

    if (!user.hasResultAccess && !employeeMatchesPerson(user, person)) {
      res.status(403).json({ error: 'ثبت آزمون فقط برای پرونده شخصی خودتان مجاز است.' });
      return;
    }

    const dims = Array.isArray(body.dims) ? body.dims.slice(0, 12) : [];
    const flags = Array.isArray(body.flags) ? body.flags.slice(0, 12) : [];
    if (dims.length === 0) {
      res.status(400).json({ error: 'داده‌های امتیازدهی ناقص است.' });
      return;
    }

    const id = makeSafeId('r');
    store.results.push({
      id,
      workspaceId: wsId,
      personId,
      ownerId: ws.ownerId,
      allowedEmails: ws.allowedEmails,
      testId,
      date: Date.now(),
      computerLabel: cleanStr(body.computerLabel, 80) || 'سرور داخلی',
      recordedByUid: user.id,
      recordedByEmail: `${user.username || user.personnelId}@internal.local`,
      examiner: ws.examiner,
      answers: Array.isArray(body.answers) ? body.answers.slice(0, 40).map(Number) : undefined,
      taskMetrics:
        body.taskMetrics && typeof body.taskMetrics === 'object' && !Array.isArray(body.taskMetrics)
          ? (body.taskMetrics as Record<string, unknown>)
          : undefined,
      dims,
      flags,
    });
    writeStore(store);
    res.status(201).json({ id });
  });

  app.delete('/api/workspaces/:wsId/results/:resultId', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const resultId = cleanStr(req.params.resultId, 128);
    const store = readStore();
    store.results = store.results.filter((r) => !(r.workspaceId === wsId && r.id === resultId));
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/workspaces/:wsId/wipe', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const store = readStore();
    store.people = store.people.filter((p) => p.workspaceId !== wsId);
    store.results = store.results.filter((r) => r.workspaceId !== wsId);
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/workspaces/:wsId/import', requirePrivileged, (req: AuthedRequest, res: Response) => {
    const wsId = cleanStr(req.params.wsId, 128);
    const store = readStore();
    const wsIdx = store.workspaces.findIndex((w) => w.id === wsId);
    if (wsIdx === -1) {
      res.status(404).json({ error: 'پایگاه داده یافت نشد.' });
      return;
    }
    const ws = store.workspaces[wsIdx];
    const body = (req.body || {}) as {
      mode?: 'merge' | 'replace';
      computerLabel?: string;
      backup?: { org?: string; examiner?: string; people?: Array<Record<string, unknown>> };
    };
    const mode = body.mode === 'replace' ? 'replace' : 'merge';
    const backup = body.backup;
    if (!backup || !Array.isArray(backup.people)) {
      res.status(400).json({ error: 'فایل پشتیبان معتبر نیست.' });
      return;
    }

    if (mode === 'replace') {
      store.people = store.people.filter((p) => p.workspaceId !== wsId);
      store.results = store.results.filter((r) => r.workspaceId !== wsId);
      if (backup.org !== undefined || backup.examiner !== undefined) {
        store.workspaces[wsIdx] = {
          ...ws,
          org: cleanStr(backup.org, 120) || ws.org,
          examiner: cleanStr(backup.examiner, 120) || ws.examiner,
        };
      }
    }

    const existingIds = new Set(
      store.people.filter((p) => p.workspaceId === wsId).map((p) => p.id)
    );
    let importedPeople = 0;
    let importedResults = 0;

    for (const rawP of backup.people) {
      if (!rawP || !rawP.name) continue;
      const rawId = cleanStr(rawP.id, 128);
      const pid = rawId && !existingIds.has(rawId) ? rawId : makeSafeId('p');
      if (existingIds.has(pid)) continue;
      existingIds.add(pid);

      store.people.push({
        id: pid,
        workspaceId: wsId,
        ownerId: ws.ownerId,
        allowedEmails: ws.allowedEmails,
        name: cleanStr(rawP.name, 120),
        code: cleanStr(rawP.code, 40),
        kind: rawP.kind === 'employee' ? 'employee' : 'candidate',
        dept: cleanStr(rawP.dept, 100),
        job: cleanStr(rawP.job, 100),
        age: cleanStr(rawP.age, 10),
        consent: true,
        created: Number(rawP.created || Date.now()),
        createdByUid: req.session!.user.id,
        createdByEmail: `${req.session!.user.username || 'admin'}@internal.local`,
      });
      importedPeople++;

      const rawResults = Array.isArray(rawP.results) ? rawP.results : [];
      for (const rawR of rawResults as Array<Record<string, unknown>>) {
        const testId = cleanStr(rawR?.testId, 32);
        if (!VALID_TEST_IDS.has(testId) || !Array.isArray(rawR.dims) || rawR.dims.length === 0) {
          continue;
        }
        store.results.push({
          id: cleanStr(rawR.id, 128) || makeSafeId('r'),
          workspaceId: wsId,
          personId: pid,
          ownerId: ws.ownerId,
          allowedEmails: ws.allowedEmails,
          testId,
          date: Number(rawR.date || Date.now()),
          computerLabel: cleanStr(body.computerLabel, 80) || 'بازیابی پشتیبان',
          recordedByUid: req.session!.user.id,
          recordedByEmail: `${req.session!.user.username || 'admin'}@internal.local`,
          examiner: ws.examiner,
          answers: Array.isArray(rawR.answers)
            ? rawR.answers.map(Number)
            : Array.isArray(rawR.data)
              ? rawR.data.map(Number)
              : undefined,
          taskMetrics:
            rawR.taskMetrics && typeof rawR.taskMetrics === 'object' && !Array.isArray(rawR.taskMetrics)
              ? (rawR.taskMetrics as Record<string, unknown>)
              : !Array.isArray(rawR.data) && rawR.data && typeof rawR.data === 'object'
                ? (rawR.data as Record<string, unknown>)
                : undefined,
          dims: rawR.dims,
          flags: Array.isArray(rawR.flags) ? rawR.flags : [],
        });
        importedResults++;
      }
    }

    writeStore(store);
    res.json({ importedPeople, importedResults });
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
    console.log(`Ravansanj Sanati internal server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
