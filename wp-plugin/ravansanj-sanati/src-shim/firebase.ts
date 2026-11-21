export const auth: any = {};
export const db: any = null;
export const googleProvider: any = null;
export function handleFirestoreError(e: any, op?: string): never { throw e; }
export function signInWithPopup(): Promise<any> { return Promise.reject(new Error('auth/unavailable-in-wordpress')); }
export function signInWithGoogle(): Promise<any> { return Promise.reject(new Error('auth/unavailable-in-wordpress')); }
export function signInWithGoogleCredentialTokens(): Promise<any> { return Promise.reject(new Error('auth/unavailable-in-wordpress')); }
export function formatFirebaseAuthError(error: unknown): string { return String(error); }
export function signOutUser(): Promise<any> { return Promise.resolve(); }
export const OperationType: any = {};
