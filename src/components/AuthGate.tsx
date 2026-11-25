import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  bootstrapLocalAdmin,
  hasLocalAdminClaimed,
  loginLocalAdmin,
  loginLocalPersonnel,
} from '../services/localAuthService';
import {
  bootstrapServerAdmin,
  getServerAuthStatus,
  loginServerAdmin,
  loginServerPersonnel,
} from '../services/serverApiService';
import {
  getConfiguredBackendUrl,
  isAndroidRuntime,
  isTauriRuntime,
  normalizeBackendUrl,
  setConfiguredBackendUrl,
} from '../utils/tauriBridge';
import type { AppUser } from '../types/psychometrics';

export interface AuthenticatedSession {
  user: AppUser;
  token: string;
  useServer: boolean;
  serverBaseUrl: string;
}

interface Props {
  onLoginSuccess: (session: AuthenticatedSession) => void;
  onToast: (msg: string) => void;
}

export const AuthGate: React.FC<Props> = ({ onLoginSuccess, onToast }) => {
  const [tab, setTab] = useState<'personnel' | 'admin'>('personnel');
  const inTauri = isTauriRuntime();
  const inAndroid = isAndroidRuntime();

  // Personnel login state (National Code or Personnel ID — employee access ONLY)
  const [identifier, setIdentifier] = useState('');
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [personnelErr, setPersonnelErr] = useState<string | null>(null);

  // Admin / Evaluator login state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminErr, setAdminErr] = useState<string | null>(null);

  // First-run Admin setup/claim state
  const [setupName, setSetupName] = useState('مدیر ارشد سیستم');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [setupErr, setSetupErr] = useState<string | null>(null);

  // Internal server connection state
  const [backendUrlInput, setBackendUrlInput] = useState<string>(() =>
    getConfiguredBackendUrl()
  );
  const [showServerConfig, setShowServerConfig] = useState<boolean>(
    () => inTauri && !getConfiguredBackendUrl()
  );
  const [checkingServer, setCheckingServer] = useState(true);
  const [serverState, setServerState] = useState<{
    connected: boolean;
    baseUrl: string;
    version?: string;
    adminClaimed: boolean;
    envAdminConfigured: boolean;
    error?: string;
  }>({
    connected: false,
    baseUrl: '',
    adminClaimed: hasLocalAdminClaimed(),
    envAdminConfigured: false,
  });

  const probeServer = useCallback(
    async (explicitUrl?: string) => {
      const targetUrl =
        explicitUrl !== undefined
          ? normalizeBackendUrl(explicitUrl)
          : normalizeBackendUrl(backendUrlInput);

      // In Tauri without any server URL configured, stay cleanly in offline local mode
      if (inTauri && !targetUrl) {
        setServerState({
          connected: false,
          baseUrl: '',
          adminClaimed: hasLocalAdminClaimed(),
          envAdminConfigured: false,
          error: 'حالت آفلاین روی دستگاه (بدون سرور داخلی)',
        });
        setCheckingServer(false);
        return;
      }

      setCheckingServer(true);
      try {
        const effectiveBase = inTauri ? targetUrl : targetUrl || '';
        const status = await getServerAuthStatus(effectiveBase);
        setServerState({
          connected: Boolean(status.ok),
          baseUrl: effectiveBase,
          version: status.version,
          adminClaimed: Boolean(status.adminClaimed),
          envAdminConfigured: Boolean(status.envAdminConfigured),
        });
      } catch (err) {
        setServerState({
          connected: false,
          baseUrl: targetUrl,
          adminClaimed: inTauri ? hasLocalAdminClaimed() : true,
          envAdminConfigured: false,
          error:
            err instanceof Error
              ? err.message
              : 'امکان برقراری ارتباط با سرور داخلی وجود ندارد.',
        });
      } finally {
        setCheckingServer(false);
      }
    },
    [backendUrlInput, inTauri]
  );

  useEffect(() => {
    void probeServer();
  }, []);

  const handleSaveServerUrl = async () => {
    const saved = setConfiguredBackendUrl(backendUrlInput);
    setBackendUrlInput(saved);
    await probeServer(saved);
  };

  // In Web mode, internal Express server handles all authentication and data isolation.
  // In Tauri mode, if a backend URL is configured & reachable it uses internal server; otherwise offline local storage.
  const canUseServer = serverState.connected;
  const blockedWebWithoutServer = !inTauri && !checkingServer && !serverState.connected;
  const blockedTauriBadServerUrl =
    inTauri && Boolean(normalizeBackendUrl(backendUrlInput)) && !checkingServer && !serverState.connected;
  const adminClaimed = canUseServer ? serverState.adminClaimed : hasLocalAdminClaimed();

  const handlePersonnelLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryId = identifier.trim();
    if (!queryId) {
      setPersonnelErr('کد ملی یا کد پرسنلی را وارد کنید.');
      return;
    }
    if (blockedWebWithoutServer) {
      setPersonnelErr('ارتباط با سرور داخلی سازمان برقرار نیست.');
      return;
    }
    if (blockedTauriBadServerUrl) {
      setPersonnelErr('سرور داخلی واردشده در دسترس نیست؛ آدرس را بررسی یا برای استفاده آفلاین پاک کنید.');
      return;
    }

    setLoadingPersonnel(true);
    setPersonnelErr(null);
    try {
      if (canUseServer) {
        const res = await loginServerPersonnel(serverState.baseUrl, queryId);
        onLoginSuccess({
          user: res.user,
          token: res.token,
          useServer: true,
          serverBaseUrl: serverState.baseUrl,
        });
        onToast(`خوش آمدید، ${res.user.name}`);
      } else {
        const user = loginLocalPersonnel(queryId);
        onLoginSuccess({
          user,
          token: '',
          useServer: false,
          serverBaseUrl: '',
        });
        onToast(`خوش آمدید، ${user.name}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ورود پرسنلی';
      setPersonnelErr(msg);
      onToast(msg);
    } finally {
      setLoadingPersonnel(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setAdminErr('نام کاربری و رمز عبور الزامی است.');
      return;
    }
    if (blockedWebWithoutServer) {
      setAdminErr('ارتباط با سرور داخلی سازمان برقرار نیست.');
      return;
    }
    if (blockedTauriBadServerUrl) {
      setAdminErr('سرور داخلی واردشده در دسترس نیست؛ آدرس را اصلاح یا برای حالت آفلاین پاک کنید.');
      return;
    }

    setLoadingAdmin(true);
    setAdminErr(null);
    try {
      if (canUseServer) {
        const res = await loginServerAdmin(serverState.baseUrl, cleanUser, password);
        onLoginSuccess({
          user: res.user,
          token: res.token,
          useServer: true,
          serverBaseUrl: serverState.baseUrl,
        });
        onToast(`خوش آمدید، ${res.user.name}`);
      } else {
        const user = await loginLocalAdmin(cleanUser, password);
        onLoginSuccess({
          user,
          token: '',
          useServer: false,
          serverBaseUrl: '',
        });
        onToast(`خوش آمدید، ${user.name}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'نام کاربری یا رمز عبور اشتباه است.';
      setAdminErr(msg);
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = setupUsername.trim();
    const cleanName = setupName.trim() || 'مدیر ارشد سیستم';
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(cleanUser)) {
      setSetupErr('نام کاربری باید حداقل ۳ کاراکتر انگلیسی، عدد، نقطه یا خط تیره باشد.');
      return;
    }
    if (setupPassword.length < 8 || setupPassword.length > 128) {
      setSetupErr('رمز عبور مدیر ارشد باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupErr('تکرار رمز عبور مطابقت ندارد.');
      return;
    }
    if (blockedWebWithoutServer) {
      setSetupErr('ارتباط با سرور داخلی سازمان برقرار نیست.');
      return;
    }

    setLoadingSetup(true);
    setSetupErr(null);
    try {
      if (canUseServer) {
        const res = await bootstrapServerAdmin(serverState.baseUrl, {
          username: cleanUser,
          password: setupPassword,
          name: cleanName,
        });
        onLoginSuccess({
          user: res.user,
          token: res.token,
          useServer: true,
          serverBaseUrl: serverState.baseUrl,
        });
        onToast('حساب مدیر ارشد با موفقیت روی سرور ایجاد و فعال شد');
      } else {
        const user = await bootstrapLocalAdmin({
          username: cleanUser,
          password: setupPassword,
          name: cleanName,
        });
        onLoginSuccess({
          user,
          token: '',
          useServer: false,
          serverBaseUrl: '',
        });
        onToast('حساب مدیر ارشد با موفقیت روی این دستگاه ایجاد و فعال شد');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در راه‌اندازی مدیر ارشد';
      setSetupErr(msg);
    } finally {
      setLoadingSetup(false);
    }
  };

  return (
    <div className="ambient-shell min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full max-w-lg bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-5 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center font-black text-xl shrink-0 shadow-[0_0_20px_var(--accent-soft)]">
              ر
            </div>
            <div>
              <h1 className="text-2xl font-black leading-tight tracking-tight">روان‌سنج صنعتی</h1>
              <p className="text-xs text-[var(--ink-muted)]">
                سامانه محرمانه آزمون‌های روان‌شناختی محیط کار
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 ${
              checkingServer
                ? 'bg-[var(--ink-faint)] text-[var(--ink-muted)]'
                : canUseServer
                ? 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>
              {checkingServer
                ? 'بررسی سرور…'
                : canUseServer
                ? 'سرور داخلی'
                : inTauri
                ? 'آفلاین محلی'
                : 'عدم اتصال'}
            </span>
          </span>
        </div>

        {(blockedWebWithoutServer || blockedTauriBadServerUrl) && (
          <div className="rounded-xl p-3.5 bg-[#fef2f2] dark:bg-[#450a0a]/60 border border-[#dc2626]/40 text-xs leading-6 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-[#dc2626] dark:text-[#f87171] shrink-0 mt-0.5" />
              <span>
                {blockedWebWithoutServer
                  ? 'ارتباط با سرور داخلی سازمان برقرار نشد. از اجرای سرویس سرور اطمینان حاصل کنید.'
                  : 'سرور داخلی تنظیم‌شده پاسخ نداد. آدرس را بررسی کنید یا برای حالت آفلاین آدرس را پاک کنید.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void probeServer()}
              className="px-2.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--ink-faint)] font-bold cursor-pointer shrink-0 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>تلاش مجدد</span>
            </button>
          </div>
        )}

        {/* 2 Tabs ONLY: Personnel vs Admin/Evaluator (Google login completely removed) */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--bg)] border border-[var(--ink-faint)] rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('personnel')}
            className={`py-2.5 rounded-lg transition-colors cursor-pointer ${
              tab === 'personnel'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            ورود پرسنل (کد ملی / پرسنلی)
          </button>
          <button
            type="button"
            onClick={() => setTab('admin')}
            className={`py-2.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              tab === 'admin'
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>مدیران / ارزیابان</span>
          </button>
        </div>

        {tab === 'personnel' && (
          <form onSubmit={handlePersonnelLogin} className="space-y-4">
            <div className="rounded-xl p-3.5 bg-[var(--accent-soft)] border border-[var(--accent)]/60 text-xs leading-6">
              <b className="text-[var(--accent)]">دسترسی اختصاصی و محرمانه پرسنل:</b> با کد ملی
              (۱۰ رقم) یا کد پرسنلی وارد شوید. هر فرد فقط به آزمون‌ها و نتیجه شخصی خود دسترسی
              دارد و اطلاعات سایر افراد کاملاً مخفی است.
            </div>
            {personnelErr && (
              <div className="rounded-xl p-3 bg-[#fef2f2] dark:bg-[#450a0a]/60 border border-[#dc2626]/40 text-xs font-medium leading-6">
                {personnelErr}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">کد ملی یا کد پرسنلی</label>
              <input
                type="text"
                required
                dir="ltr"
                placeholder="مثلاً: 0000000001 یا 10001"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  setPersonnelErr(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr font-semibold"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setIdentifier('10001');
                setPersonnelErr(null);
              }}
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

        {tab === 'admin' && !adminClaimed && (
          <form onSubmit={handleBootstrapAdmin} className="space-y-3.5">
            <div className="rounded-xl p-3.5 bg-[var(--accent-soft)] border border-[var(--accent)]/60 text-xs leading-6 flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-[var(--accent)] shrink-0 mt-1" />
              <div>
                <b>راه‌اندازی امن اولیه مدیر ارشد:</b> هنوز حساب مدیر ارشد تعریف نشده است. این
                فرم فقط یک بار نمایش داده می‌شود تا نام کاربری و رمز اختصاصی محرمانه خود را ثبت
                کنید.
              </div>
            </div>
            {setupErr && (
              <div className="rounded-xl p-3 bg-[#fef2f2] dark:bg-[#450a0a]/60 border border-[#dc2626]/40 text-xs font-medium">
                {setupErr}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">نام و عنوان مدیر</label>
              <input
                type="text"
                required
                maxLength={120}
                value={setupName}
                onChange={(e) => setSetupName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">نام کاربری مدیر (انگلیسی)</label>
              <input
                type="text"
                required
                dir="ltr"
                placeholder="مثلاً: hse_admin"
                value={setupUsername}
                onChange={(e) => setSetupUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">رمز عبور (حداقل ۸ کاراکتر)</label>
                <input
                  type="password"
                  required
                  dir="ltr"
                  minLength={8}
                  value={setupPassword}
                  onChange={(e) => setSetupPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">تکرار رمز عبور</label>
                <input
                  type="password"
                  required
                  dir="ltr"
                  minLength={8}
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingSetup}
              className="w-full py-3 px-4 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-95 disabled:opacity-60 cursor-pointer text-sm"
            >
              {loadingSetup ? 'در حال ایجاد حساب مدیر…' : 'ثبت مدیر ارشد و ورود'}
            </button>
          </form>
        )}

        {tab === 'admin' && adminClaimed && (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="rounded-xl p-3.5 bg-[var(--bg)] border border-[var(--ink-faint)] text-xs leading-6 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0 mt-1" />
              <span>
                <b>ورود اختصاصی مدیران و ارزیابان (HSE / طب کار):</b> دسترسی به پرونده‌ها و نتایج
                محرمانه پرسنل فقط با نام کاربری و رمز عبور مجاز است.
              </span>
            </div>
            {adminErr && (
              <div className="rounded-xl p-3 bg-[#fef2f2] dark:bg-[#450a0a]/60 border border-[#dc2626]/40 text-xs font-medium">
                {adminErr}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">نام کاربری</label>
              <input
                type="text"
                required
                dir="ltr"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setAdminErr(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">رمز عبور</label>
              <input
                type="password"
                required
                dir="ltr"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAdminErr(null);
                }}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--bg)] text-sm num-ltr"
              />
            </div>
            <button
              type="submit"
              disabled={loadingAdmin}
              className="w-full py-3 px-4 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-95 disabled:opacity-60 cursor-pointer text-sm"
            >
              {loadingAdmin ? 'در حال بررسی اعتبارنامه…' : 'ورود مدیریت'}
            </button>
          </form>
        )}

        {inTauri && (
          <div className="rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)]/60 p-3 space-y-2.5">
            <button
              type="button"
              onClick={() => setShowServerConfig((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-[var(--ink)] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>اتصال به سرور داخلی سازمان (اختیاری)</span>
              </span>
              <span className="text-[11px] text-[var(--accent)]">
                {showServerConfig ? 'بستن' : backendUrlInput ? 'تغییر آدرس' : 'تنظیم آدرس'}
              </span>
            </button>

            {showServerConfig && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="http://192.168.1.10:3000"
                    value={backendUrlInput}
                    onChange={(e) => setBackendUrlInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-[var(--ink-faint)] focus:border-[var(--accent)] outline-none bg-[var(--surface)] text-xs num-ltr"
                  />
                  <button
                    type="button"
                    disabled={checkingServer}
                    onClick={() => void handleSaveServerUrl()}
                    className="px-3 py-2 rounded-lg bg-[var(--ink-faint)] hover:border-[var(--accent)]/50 border border-[var(--ink-faint)] text-xs font-bold cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {checkingServer ? 'بررسی…' : 'ذخیره و بررسی'}
                  </button>
                </div>
                {!checkingServer && (
                  <p
                    className={`text-[11px] flex items-center gap-1.5 ${
                      canUseServer ? 'text-emerald-500' : 'text-[var(--ink-muted)]'
                    }`}
                  >
                    {canUseServer ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          متصل به سرور داخلی (نسخه {serverState.version || '—'})
                        </span>
                      </>
                    ) : (
                      <span>
                        {inAndroid || inTauri
                          ? 'برای استفاده همگام بین چند دستگاه، آدرس سرور داخلی (node server.ts) را وارد کنید یا فیلد را خالی بگذارید تا روی همین دستگاه ذخیره شود.'
                          : ''}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
