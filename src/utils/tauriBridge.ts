export interface GoogleBridgeTokens {
  googleIdToken?: string;
  googleAccessToken?: string;
  email?: string;
  displayName?: string;
}

export interface BackendHealthResult {
  ok: boolean;
  version?: string;
  authBridge?: boolean;
  error?: string;
}

const BACKEND_URL_STORAGE_KEY = 'rsi_backend_url';

interface TauriInternals {
  invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
}

function getTauriInternals(): TauriInternals | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
}

export function isTauriRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  const host = window.location.hostname.toLowerCase();
  return Boolean(
    w.__TAURI_INTERNALS__ ||
      w.__TAURI__ ||
      host === 'tauri.localhost' ||
      window.location.protocol === 'tauri:'
  );
}

export function isAndroidRuntime(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

export function isDesktopTauriRuntime(): boolean {
  return isTauriRuntime() && !isAndroidRuntime();
}

export function normalizeBackendUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getConfiguredBackendUrl(): string {
  try {
    const saved = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      return normalizeBackendUrl(saved);
    }
  } catch {
    // ignore storage errors
  }

  const envUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL
      ? String(import.meta.env.VITE_BACKEND_URL)
      : '';
  if (envUrl.trim()) {
    return normalizeBackendUrl(envUrl);
  }

  if (typeof window !== 'undefined' && !isTauriRuntime()) {
    const origin = window.location.origin;
    if (/^https?:\/\//i.test(origin)) {
      return origin;
    }
  }

  return '';
}

export function setConfiguredBackendUrl(url: string): string {
  const normalized = normalizeBackendUrl(url);
  try {
    if (normalized) {
      localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
  return normalized;
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const internals = getTauriInternals();
  if (!internals?.invoke) {
    throw new Error('رابط بومی Tauri در دسترس نیست.');
  }
  return internals.invoke<T>(cmd, args);
}

export async function openExternalBrowser(url: string): Promise<void> {
  if (getTauriInternals()?.invoke) {
    await tauriInvoke<void>('open_external_url', { url });
    return;
  }
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    throw new Error('مرورگر اجازه باز کردن پنجره جدید را نداد.');
  }
}

export async function checkBackendHealth(backendUrl: string): Promise<BackendHealthResult> {
  const base = normalizeBackendUrl(backendUrl);
  if (!base) {
    return { ok: false, error: 'آدرس سرور بک‌اند وارد نشده است.' };
  }
  try {
    const resp = await fetch(`${base}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(4500),
    });
    if (!resp.ok) {
      return { ok: false, error: `پاسخ نامعتبر سرور (HTTP ${resp.status})` };
    }
    const data = (await resp.json()) as {
      ok?: boolean;
      version?: string;
      authBridge?: boolean;
    };
    if (!data?.ok) {
      return { ok: false, error: 'سرویس بک‌اند آماده نیست.' };
    }
    return {
      ok: true,
      version: data.version,
      authBridge: Boolean(data.authBridge),
    };
  } catch {
    return { ok: false, error: 'امکان برقراری ارتباط با سرور بک‌اند وجود ندارد.' };
  }
}

function generateRandomHex(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function waitOrWake(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const onFocus = () => finish();
    const onVisible = () => {
      if (document.visibilityState === 'visible') finish();
    };
    const onAbort = () => finish();
    const timer = window.setTimeout(finish, ms);
    window.addEventListener('focus', onFocus, { once: true });
    document.addEventListener('visibilitychange', onVisible);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function signInGoogleViaBackendBridge(
  backendUrl: string,
  onStatus: (msg: string) => void,
  signal?: AbortSignal
): Promise<GoogleBridgeTokens> {
  const base = normalizeBackendUrl(backendUrl);
  if (!base) {
    throw new Error('آدرس سرور بک‌اند مشخص نشده است.');
  }

  onStatus('در حال ایجاد نشست امن احراز هویت با بک‌اند...');
  const createResp = await fetch(`${base}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
  });

  if (!createResp.ok) {
    let errText = `خطای سرور (${createResp.status})`;
    try {
      const parsed = (await createResp.json()) as { error?: string };
      if (parsed?.error) errText = parsed.error;
    } catch {
      // ignore
    }
    throw new Error(errText);
  }

  const { sessionId, readSecret, writeSecret, expiresAt } = (await createResp.json()) as {
    sessionId: string;
    readSecret: string;
    writeSecret: string;
    expiresAt: number;
  };

  const bridgeUrl = `${base}/?authBridge=${encodeURIComponent(sessionId)}#ws=${encodeURIComponent(writeSecret)}`;
  onStatus('در حال باز کردن مرورگر سیستم برای ورود با حساب گوگل...');
  await openExternalBrowser(bridgeUrl);

  onStatus('لطفاً ورود گوگل را در مرورگر تکمیل کنید و سپس به برنامه برگردید...');
  const deadline = Math.min(expiresAt || Date.now() + 300_000, Date.now() + 300_000);

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new Error('عملیات ورود توسط کاربر لغو شد.');
    }

    await waitOrWake(1400, signal);
    if (signal?.aborted) {
      throw new Error('عملیات ورود توسط کاربر لغو شد.');
    }

    const pollResp = await fetch(`${base}/api/auth/session/${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${readSecret}`,
      },
      signal,
    });

    if (pollResp.status === 410) {
      throw new Error('مهلت نشست ورود گوگل به پایان رسید. لطفاً دوباره تلاش کنید.');
    }
    if (!pollResp.ok) {
      throw new Error(`خطا در دریافت وضعیت ورود (${pollResp.status})`);
    }

    const pollData = (await pollResp.json()) as {
      status: 'pending' | 'completed' | 'error' | 'expired';
      googleIdToken?: string;
      googleAccessToken?: string;
      email?: string;
      displayName?: string;
      error?: string;
    };

    if (pollData.status === 'error') {
      throw new Error(pollData.error || 'احراز هویت گوگل در مرورگر ناموفق بود.');
    }

    if (pollData.status === 'completed') {
      if (!pollData.googleIdToken && !pollData.googleAccessToken) {
        throw new Error('پاسخ بک‌اند فاقد توکن گوگل بود.');
      }
      return {
        googleIdToken: pollData.googleIdToken,
        googleAccessToken: pollData.googleAccessToken,
        email: pollData.email,
        displayName: pollData.displayName,
      };
    }
  }

  throw new Error('زمان انتظار برای ورود گوگل به پایان رسید.');
}

interface LoopbackPollResult {
  status: string;
  googleIdToken?: string | null;
  googleAccessToken?: string | null;
  email?: string | null;
  displayName?: string | null;
  error?: string | null;
}

export async function signInGoogleViaWindowsLoopback(
  onStatus: (msg: string) => void,
  signal?: AbortSignal
): Promise<GoogleBridgeTokens> {
  const writeSecret = generateRandomHex(24);
  onStatus('در حال راه‌اندازی درگاه محلی ورود ویندوز...');

  const port = await tauriInvoke<number>('start_windows_loopback_auth', {
    writeSecret,
  });

  const localOrigin = window.location.origin;
  const authUrl = `${localOrigin}/?authBridge=loopback&port=${encodeURIComponent(String(port))}#ws=${encodeURIComponent(writeSecret)}`;

  onStatus('در حال باز کردن مرورگر پیش‌فرض ویندوز (Chrome/Edge)...');
  await openExternalBrowser(authUrl);

  onStatus('لطفاً ورود با حساب گوگل را در مرورگر انجام دهید...');
  const deadline = Date.now() + 300_000;

  try {
    while (Date.now() < deadline) {
      if (signal?.aborted) {
        await tauriInvoke('cancel_windows_loopback_auth').catch(() => {});
        throw new Error('عملیات ورود توسط کاربر لغو شد.');
      }

      await waitOrWake(900, signal);
      if (signal?.aborted) {
        await tauriInvoke('cancel_windows_loopback_auth').catch(() => {});
        throw new Error('عملیات ورود توسط کاربر لغو شد.');
      }

      const res = await tauriInvoke<LoopbackPollResult>('poll_windows_loopback_auth');
      if (res.status === 'error') {
        throw new Error(res.error || 'احراز هویت گوگل در مرورگر ناموفق بود.');
      }
      if (res.status === 'completed') {
        if (!res.googleIdToken && !res.googleAccessToken) {
          throw new Error('توکن گوگل از مرورگر دریافت نشد.');
        }
        return {
          googleIdToken: res.googleIdToken ?? undefined,
          googleAccessToken: res.googleAccessToken ?? undefined,
          email: res.email ?? undefined,
          displayName: res.displayName ?? undefined,
        };
      }
      if (res.status === 'none') {
        throw new Error('نشست ورود محلی بسته شد.');
      }
    }
    throw new Error('زمان انتظار برای تکمیل ورود گوگل به پایان رسید.');
  } catch (err) {
    await tauriInvoke('cancel_windows_loopback_auth').catch(() => {});
    throw err;
  }
}
