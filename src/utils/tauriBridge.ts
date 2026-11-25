export interface BackendHealthResult {
  ok: boolean;
  version?: string;
  adminClaimed?: boolean;
  envAdminConfigured?: boolean;
  error?: string;
}

const BACKEND_URL_STORAGE_KEY = 'rsi_backend_url';

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
  return `http://${trimmed}`;
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

export async function checkBackendHealth(backendUrl: string): Promise<BackendHealthResult> {
  const base = normalizeBackendUrl(backendUrl);
  if (!base) {
    return { ok: false, error: 'آدرس سرور داخلی وارد نشده است.' };
  }
  try {
    const resp = await fetch(`${base}/api/auth/status`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) {
      return { ok: false, error: `پاسخ نامعتبر سرور (HTTP ${resp.status})` };
    }
    const data = (await resp.json()) as {
      ok?: boolean;
      version?: string;
      adminClaimed?: boolean;
      envAdminConfigured?: boolean;
    };
    if (!data?.ok) {
      return { ok: false, error: 'سرور داخلی آماده نیست.' };
    }
    return {
      ok: true,
      version: data.version,
      adminClaimed: Boolean(data.adminClaimed),
      envAdminConfigured: Boolean(data.envAdminConfigured),
    };
  } catch {
    return { ok: false, error: 'امکان برقراری ارتباط با سرور داخلی وجود ندارد.' };
  }
}
