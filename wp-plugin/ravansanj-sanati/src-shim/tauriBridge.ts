export function isTauriRuntime(): boolean { return false; }
export function isAndroidRuntime(): boolean { return false; }
export function isDesktopTauriRuntime(): boolean { return false; }
export function normalizeBackendUrl(raw: string): string { return raw; }
export function getConfiguredBackendUrl(): string { return ''; }
export function setConfiguredBackendUrl(url: string): string { return url; }
export function checkBackendHealth(_url: string): Promise<any> { return Promise.reject(new Error('unavailable')); }
export function signInGoogleViaBackendBridge(): Promise<any> { return Promise.reject(new Error('unavailable')); }
export function signInGoogleViaWindowsLoopback(): Promise<any> { return Promise.reject(new Error('unavailable')); }
