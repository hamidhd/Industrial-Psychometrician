import { SAMPLE_MASTER_EMPLOYEES } from '../data/initialPersonnel';
import type { AppUser, ManagedAuthUser } from '../types/psychometrics';

const LOCAL_AUTH_KEY = 'rsi_local_auth_v3';

interface StoredLocalAuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'evaluator';
  dept: string;
  salt: string;
  hash: string; // PBKDF2 SHA-256 100k iterations hex
  createdAt: number;
}

function readLocalAuthUsers(): StoredLocalAuthUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAuthUsers(users: StoredLocalAuthUser[]): void {
  localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(users));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derivePbkdf2(password: string, saltHex: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('مرورگر یا محیط فعلی از رمزنگاری Web Crypto پشتیبانی نمی‌کند.');
  }
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const saltBytes = fromHex(saltHex);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(derivedBits));
}

function randomHex(byteLen = 16): string {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

function makeLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomHex(4)}`;
}

export function hasLocalAdminClaimed(): boolean {
  return readLocalAuthUsers().some((u) => u.role === 'admin');
}

export async function bootstrapLocalAdmin(input: {
  username: string;
  password: string;
  name: string;
}): Promise<AppUser> {
  const users = readLocalAuthUsers();
  if (users.some((u) => u.role === 'admin')) {
    throw new Error('حساب مدیر ارشد قبلاً در این دستگاه تعریف شده است.');
  }

  const username = input.username.trim();
  const name = input.name.trim() || 'مدیر ارشد سیستم';
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) {
    throw new Error('نام کاربری باید حداقل ۳ کاراکتر انگلیسی یا عدد باشد.');
  }
  if (input.password.length < 8 || input.password.length > 128) {
    throw new Error('رمز عبور باید حداقل ۸ کاراکتر باشد.');
  }

  const salt = randomHex(16);
  const hash = await derivePbkdf2(input.password, salt);
  const created: StoredLocalAuthUser = {
    id: makeLocalId('locadm'),
    username,
    name,
    role: 'admin',
    dept: 'ایمنی و بهداشت / مدیریت',
    salt,
    hash,
    createdAt: Date.now(),
  };

  users.push(created);
  writeLocalAuthUsers(users);

  return {
    id: created.id,
    personnelId: '1001',
    name: created.name,
    nationalCode: '',
    mobile: '',
    dept: created.dept,
    hireDate: '',
    role: 'admin',
    username: created.username,
    hasResultAccess: true,
  };
}

export async function loginLocalAdmin(username: string, password: string): Promise<AppUser> {
  const cleanUser = username.trim();
  if (!cleanUser || !password) {
    throw new Error('نام کاربری و رمز عبور الزامی است.');
  }
  const users = readLocalAuthUsers();
  const found = users.find(
    (u) => (u.role === 'admin' || u.role === 'evaluator') && u.username === cleanUser
  );
  if (!found) {
    throw new Error('نام کاربری یا رمز عبور اشتباه است.');
  }
  const computed = await derivePbkdf2(password, found.salt);
  if (!constantTimeHexEqual(computed, found.hash)) {
    throw new Error('نام کاربری یا رمز عبور اشتباه است.');
  }
  return {
    id: found.id,
    personnelId: '',
    name: found.name,
    nationalCode: '',
    mobile: '',
    dept: found.dept,
    hireDate: '',
    role: found.role,
    username: found.username,
    hasResultAccess: true,
  };
}

export function loginLocalPersonnel(identifier: string): AppUser {
  const queryId = identifier.trim();
  if (!queryId) {
    throw new Error('کد ملی یا کد پرسنلی را وارد کنید.');
  }

  // Strictly block any privileged username from logging in via personnel tab
  const privilegedUsers = readLocalAuthUsers();
  if (
    queryId.toLowerCase() === 'admin' ||
    privilegedUsers.some((u) => u.username.toLowerCase() === queryId.toLowerCase())
  ) {
    throw new Error('این شناسه متعلق به حساب مدیریتی است؛ از بخش مدیران با رمز عبور وارد شوید.');
  }

  let matchedName = '';
  let matchedCode = queryId;
  let matchedDept = 'عمومی';

  const sample = SAMPLE_MASTER_EMPLOYEES.find(
    (e) => e.personnelId === queryId || e.nationalCode === queryId || e.mobile === queryId
  );
  if (sample) {
    matchedName = sample.name;
    matchedCode = sample.personnelId;
    matchedDept = sample.dept;
  } else {
    try {
      const rawDb = localStorage.getItem('rsi_local_db_v2');
      if (rawDb) {
        const parsedDb = JSON.parse(rawDb);
        if (Array.isArray(parsedDb?.people)) {
          const person = parsedDb.people.find(
            (p: { code?: string; name?: string; dept?: string }) =>
              p && p.code && p.code.trim() === queryId
          );
          if (person) {
            matchedName = person.name || 'پرسنل گرامی';
            matchedCode = person.code;
            matchedDept = person.dept || 'عمومی';
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return {
    id: `emp_loc_${queryId}`,
    personnelId: matchedCode,
    name: matchedName || 'پرسنل گرامی',
    nationalCode: /^\d{10}$/.test(queryId) ? queryId : '0000000000',
    mobile: '',
    dept: matchedDept,
    hireDate: '',
    role: 'employee',
    hasResultAccess: false,
  };
}

export async function changeLocalPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!currentPassword || newPassword.length < 8 || newPassword.length > 128) {
    throw new Error('رمز عبور فعلی و رمز جدید (حداقل ۸ کاراکتر) را وارد کنید.');
  }
  const users = readLocalAuthUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    throw new Error('حساب کاربری یافت نشد.');
  }
  const computed = await derivePbkdf2(currentPassword, users[idx].salt);
  if (!constantTimeHexEqual(computed, users[idx].hash)) {
    throw new Error('رمز عبور فعلی نادرست است.');
  }
  const nextSalt = randomHex(16);
  const nextHash = await derivePbkdf2(newPassword, nextSalt);
  users[idx] = { ...users[idx], salt: nextSalt, hash: nextHash };
  writeLocalAuthUsers(users);
}

export function listLocalUsers(): ManagedAuthUser[] {
  return readLocalAuthUsers().map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    dept: u.dept,
    createdAt: u.createdAt,
  }));
}

export async function createLocalUser(input: {
  username: string;
  name: string;
  dept: string;
  role: 'admin' | 'evaluator';
  password: string;
}): Promise<ManagedAuthUser> {
  const username = input.username.trim();
  const name = input.name.trim();
  const dept = input.dept.trim() || 'ایمنی و بهداشت';
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) {
    throw new Error('نام کاربری باید حداقل ۳ کاراکتر انگلیسی یا عدد باشد.');
  }
  if (!name || input.password.length < 8 || input.password.length > 128) {
    throw new Error('نام کامل و رمز عبور (حداقل ۸ کاراکتر) را وارد کنید.');
  }
  const users = readLocalAuthUsers();
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('این نام کاربری قبلاً ثبت شده است.');
  }
  const salt = randomHex(16);
  const hash = await derivePbkdf2(input.password, salt);
  const created: StoredLocalAuthUser = {
    id: makeLocalId('locusr'),
    username,
    name,
    role: input.role === 'admin' ? 'admin' : 'evaluator',
    dept,
    salt,
    hash,
    createdAt: Date.now(),
  };
  users.push(created);
  writeLocalAuthUsers(users);
  return {
    id: created.id,
    username: created.username,
    name: created.name,
    role: created.role,
    dept: created.dept,
    createdAt: created.createdAt,
  };
}

export function deleteLocalUser(currentUserId: string, targetUserId: string): void {
  if (currentUserId === targetUserId) {
    throw new Error('امکان حذف حساب کاربری فعال خودتان وجود ندارد.');
  }
  const users = readLocalAuthUsers();
  const target = users.find((u) => u.id === targetUserId);
  if (!target) {
    throw new Error('کاربر یافت نشد.');
  }
  if (target.role === 'admin') {
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      throw new Error('حداقل یک حساب مدیر ارشد باید باقی بماند.');
    }
  }
  writeLocalAuthUsers(users.filter((u) => u.id !== targetUserId));
}
