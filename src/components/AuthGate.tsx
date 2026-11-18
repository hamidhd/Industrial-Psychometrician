import React, { useState } from 'react';
import { KeyRound, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { INITIAL_MASTER_PERSONNEL } from '../data/initialPersonnel';
import { signInWithGoogle } from '../firebase';
import type { AppUser } from '../types/psychometrics';

interface Props {
  onLoginSuccess: (user: AppUser) => void;
  onToast: (msg: string) => void;
}

export const AuthGate: React.FC<Props> = ({ onLoginSuccess, onToast }) => {
  const [tab, setTab] = useState<'personnel' | 'admin' | 'google'>('personnel');

  // Personnel login state (National Code or Personnel ID)
  const [identifier, setIdentifier] = useState('');
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);

  // Admin login state (Username & Password)
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminErr, setAdminErr] = useState<string | null>(null);

  // Password change modal state after first login
  const [pendingUser, setPendingUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Load stored users cleanly (migrating only admin/evaluator credentials from v1 if present)
  const getUsers = (): AppUser[] => {
    const buildSeeded = (): AppUser[] =>
      INITIAL_MASTER_PERSONNEL.map((p, idx) => ({
        id: `u_${idx}_${p.personnelId}`,
        personnelId: p.personnelId,
        name: p.name,
        nationalCode: p.nationalCode,
        mobile: p.mobile,
        dept: p.dept,
        hireDate: p.hireDate,
        role: p.role,
        username: p.username || (p.role === 'admin' ? 'admin' : undefined),
        passwordHash: p.password || p.nationalCode,
        mustChangePassword: p.mustChangePassword ?? (p.role !== 'employee'),
        hasResultAccess: p.hasResultAccess,
      }));

    const STORAGE_V2 = 'rsi_app_users_v2';
    try {
      const rawV2 = localStorage.getItem(STORAGE_V2);
      if (rawV2) {
        const parsed = JSON.parse(rawV2);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const existingPids = new Set(parsed.map((u: AppUser) => u.personnelId));
          const existingNids = new Set(parsed.map((u: AppUser) => u.nationalCode));
          const additions = buildSeeded().filter(
            (s) => !existingPids.has(s.personnelId) && !existingNids.has(s.nationalCode)
          );
          if (additions.length > 0) {
            const merged = [...parsed, ...additions];
            localStorage.setItem(STORAGE_V2, JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      }

      // Migrate custom or password-updated admin/evaluator entries from legacy key if present
      const seeded = buildSeeded();
      const rawV1 = localStorage.getItem('rsi_app_users');
      if (rawV1) {
        const v1 = JSON.parse(rawV1);
        if (Array.isArray(v1)) {
          const v1Privileged = v1.filter((u: AppUser) => u && u.hasResultAccess);
          const merged = seeded.map((s) => {
            const match = v1Privileged.find(
              (u: AppUser) => u.username && s.username && u.username === s.username
            );
            return match ? { ...s, passwordHash: match.passwordHash, mustChangePassword: match.mustChangePassword } : s;
          });
          localStorage.setItem(STORAGE_V2, JSON.stringify(merged));
          return merged;
        }
      }
    } catch {
      // fallback
    }
    const seeded = buildSeeded();
    localStorage.setItem(STORAGE_V2, JSON.stringify(seeded));
    return seeded;
  };

  const handlePersonnelLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const queryId = identifier.trim();
    if (!queryId) {
      onToast('کد ملی یا کد پرسنلی را وارد کنید');
      return;
    }
    setLoadingPersonnel(true);
    try {
      const users = getUsers();
      const found = users.find(
        (u) => u.nationalCode === queryId || u.personnelId === queryId || u.mobile === queryId
      );
      if (found) {
        if (found.mustChangePassword) {
          setPendingUser(found);
        } else {
          onLoginSuccess(found);
          onToast(`خوش آمدید، ${found.name}`);
        }
        return;
      }

      // Check local database people list (e.g., staff imported from Excel/CSV by the organization)
      let matchedImported: { name: string; code: string; dept: string } | null = null;
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
              matchedImported = {
                name: person.name || 'پرسنل گرامی',
                code: person.code,
                dept: person.dept || 'عمومی',
              };
            }
          }
        }
      } catch {
        // ignore parse errors
      }

      const dynamicUser: AppUser = {
        id: `u_dyn_${Date.now()}`,
        personnelId: matchedImported ? matchedImported.code : queryId.length <= 6 ? queryId : '99999',
        name: matchedImported ? matchedImported.name : 'پرسنل گرامی',
        nationalCode: queryId.length === 10 ? queryId : '0000000000',
        mobile: '',
        dept: matchedImported ? matchedImported.dept : 'عمومی',
        hireDate: '1405/01/01',
        role: 'employee',
        hasResultAccess: false,
      };
      users.push(dynamicUser);
      localStorage.setItem('rsi_app_users_v2', JSON.stringify(users));
      onLoginSuccess(dynamicUser);
      onToast(matchedImported ? `خوش آمدید، ${matchedImported.name}` : 'خوش آمدید');
    } finally {
      setLoadingPersonnel(false);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const uName = username.trim();
    const pass = password;
    if (!uName || !pass) {
      setAdminErr('نام کاربری و رمز عبور را وارد کنید');
      return;
    }
    setLoadingAdmin(true);
    setAdminErr(null);
    try {
      const users = getUsers();
      const found = users.find(
        (u) =>
          (u.username === uName || u.nationalCode === uName || u.personnelId === uName) &&
          (u.passwordHash === pass || u.nationalCode === pass)
      );
      if (found) {
        if (found.mustChangePassword) {
          setPendingUser(found);
        } else {
          onLoginSuccess(found);
          onToast(`خوش آمدید، ${found.name}`);
        }
      } else {
        setAdminErr('نام کاربری یا رمز عبور اشتباه است');
      }
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingUser) return;
    if (!newPassword || newPassword.length < 6) {
      onToast('رمز عبور جدید باید حداقل ۶ کاراکتر باشد');
      return;
    }
    if (newPassword !== confirmPassword) {
      onToast('تکرار رمز عبور مطابقت ندارد');
      return;
    }
    setChangingPass(true);
    try {
      const users = getUsers();
      const updated = users.map((u) => {
        if (u.id === pendingUser.id) {
          return {
            ...u,
            passwordHash: newPassword,
            mustChangePassword: false,
          };
        }
        return u;
      });
      localStorage.setItem('rsi_app_users_v2', JSON.stringify(updated));
      const finalUsr = updated.find((u) => u.id === pendingUser.id)!;
      setPendingUser(null);
      onLoginSuccess(finalUsr);
      onToast('رمز عبور با موفقیت به‌روزرسانی شد');
    } finally {
      setChangingPass(false);
    }
  };

  const handleGoogle = async () => {
    try {
      const cred = await signInWithGoogle();
      const fbUser = cred.user;
      const adminUsr: AppUser = {
        id: fbUser.uid,
        personnelId: '1000',
        name: fbUser.displayName || fbUser.email || 'مدیر سیستم (گوگل)',
        nationalCode: '0000000000',
        mobile: '',
        dept: 'مدیریت',
        hireDate: '1400/01/01',
        role: 'admin',
        hasResultAccess: true,
      };
      onLoginSuccess(adminUsr);
      onToast('با موفقیت به پایگاه داده ابری متصل شدید');
    } catch {
      onToast('امکان اتصال به حساب گوگل وجود ندارد؛ از ورود پرسنل یا مدیران استفاده کنید');
    }
  };

  if (pendingUser) {
    return (
      <div className="ambient-shell min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
        <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center font-black text-lg shrink-0 shadow-[0_0_20px_var(--accent-soft)]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold">تغییر رمز عبور الزامی است</h1>
              <p className="text-xs text-[var(--ink-muted)]">
                {pendingUser.name} عزیز، لطفاً برای امنیت حساب کاربری خود رمز عبور جدید تعیین کنید.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1">رمز عبور جدید (حداقل ۶ کاراکتر)</label>
              <input
                type="password"
                required
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">تکرار رمز عبور جدید</label>
              <input
                type="password"
                required
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <button
              type="submit"
              disabled={changingPass}
              className="w-full py-2.5 px-4 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-95 cursor-pointer text-sm"
            >
              {changingPass ? 'در حال ذخیره…' : 'ثبت رمز عبور جدید و ورود'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="ambient-shell min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 pb-5 mb-6 border-b border-[var(--ink-faint)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center font-black text-xl shrink-0 shadow-[0_0_20px_var(--accent-soft)]">
            ر
          </div>
          <div>
            <h1 className="text-2xl font-black leading-tight tracking-tight">روان‌سنج صنعتی</h1>
            <p className="text-xs text-[var(--ink-muted)]">
              سامانه جامع آزمون‌های روان‌شناختی محیط کار
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--bg)] border border-[var(--ink-faint)] rounded-xl mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('personnel')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              tab === 'personnel'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            ورود پرسنل (کد ملی)
          </button>
          <button
            type="button"
            onClick={() => setTab('admin')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              tab === 'admin'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            مدیران / ارزیابان
          </button>
          <button
            type="button"
            onClick={() => setTab('google')}
            className={`py-2 rounded-lg transition-colors cursor-pointer ${
              tab === 'google'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            حساب گوگل
          </button>
        </div>

        {tab === 'personnel' && (
          <form onSubmit={handlePersonnelLogin} className="space-y-4">
            <div className="rounded-xl p-3.5 bg-[var(--accent-soft)] border border-[var(--accent)] text-xs leading-6">
              <b className="text-[var(--accent)]">تکمیل آزمون برای پرسنل:</b> کد ملی (۱۰ رقم) یا کد پرسنلی خود را وارد کنید تا به
              پرسشنامه‌ها و آزمون‌های اختصاص‌یافته دسترسی پیدا کنید.
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">کد ملی یا کد پرسنلی</label>
              <input
                type="text"
                required
                dir="ltr"
                placeholder="مثلاً: 0000000001 یا 10001"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr font-semibold"
              />
            </div>
            <button
              type="button"
              onClick={() => setIdentifier('10001')}
              className="text-xs text-[var(--accent)] hover:underline cursor-pointer block"
            >
              نمونه تست پرسنلی (کد پرسنلی: 10001)
            </button>
            <button
              type="submit"
              disabled={loadingPersonnel}
              className="w-full py-3 px-4 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-95 disabled:opacity-60 cursor-pointer text-sm"
            >
              {loadingPersonnel ? 'در حال بررسی…' : 'ورود به سامانه آزمون'}
            </button>
          </form>
        )}

        {tab === 'admin' && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="rounded-xl p-3.5 bg-[#fef9c3] dark:bg-[#422006]/50 border border-[#ca8a04]/40 text-xs leading-6">
              <b>ویژه‌ی مدیران و ارزیابان (HSE / طب کار):</b> دسترسی کامل به نتایج، گزارش‌ها و مدیریت
              کاربران. نام کاربری پیش‌فرض مدیر: <code className="num-ltr">admin</code> / رمز عبور:{' '}
              <code className="num-ltr">admin123</code> (در اولین ورود تغییر خواهد کرد).
            </div>
            {adminErr && (
              <div className="rounded-xl p-3 bg-[#fef2f2] dark:bg-[#450a0a]/60 border border-[#dc2626]/40 dark:border-[#f87171]/40 text-xs font-medium">
                {adminErr}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">نام کاربری یا کد ملی</label>
              <input
                type="text"
                required
                dir="ltr"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">رمز عبور</label>
              <input
                type="password"
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loadingAdmin}
              className="w-full py-3 px-4 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-95 disabled:opacity-60 cursor-pointer text-sm"
            >
              {loadingAdmin ? 'در حال ورود…' : 'ورود مدیریت'}
            </button>
          </form>
        )}

        {tab === 'google' && (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-[var(--ink-muted)]">
              اگر به اینترنت و حساب گوگل دسترسی دارید، می‌توانید از طریق دکمه‌ی زیر به پایگاه داده ابری
              مشترک متصل شوید.
            </p>
            <button
              type="button"
              onClick={handleGoogle}
              className="w-full py-3 px-4 rounded-lg font-bold bg-[var(--ink-faint)] border border-[var(--ink-faint)] hover:border-[var(--accent)]/50 cursor-pointer text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Users className="w-4 h-4 text-[var(--accent)]" />
              <span>ورود با حساب گوگل</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
