import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithGoogleCredentialTokens(
  idToken?: string | null,
  accessToken?: string | null
) {
  if (!idToken && !accessToken) {
    throw new Error('توکن احراز هویت گوگل دریافت نشد.');
  }
  const credential = GoogleAuthProvider.credential(idToken ?? null, accessToken ?? null);
  return signInWithCredential(auth, credential);
}

export function formatFirebaseAuthError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error || '');
  const code = (error as { code?: string } | null)?.code || '';

  if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
    return 'پنجره ورود گوگل قبل از تکمیل بسته شد.';
  }
  if (code === 'auth/popup-blocked' || msg.includes('popup-blocked')) {
    return 'مرورگر پنجره بازشو (Popup) ورود گوگل را مسدود کرد؛ اجازه بازشدن پنجره را بدهید.';
  }
  if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
    return 'دامنه فعلی در Firebase Auth مجاز نیست؛ از مرورگر سیستم و سرور بک‌اند استفاده کنید.';
  }
  if (code === 'auth/network-request-failed' || msg.includes('network-request-failed')) {
    return 'ارتباط با سرورهای گوگل برقرار نشد؛ اتصال اینترنت یا فیلترشکن را بررسی کنید.';
  }
  if (code === 'auth/cancelled-popup-request') {
    return 'درخواست ورود قبلی در حال اجرا است.';
  }
  if (msg) {
    return msg;
  }
  return 'امکان اتصال به حساب گوگل وجود ندارد؛ از ورود پرسنل یا مدیران استفاده کنید.';
}

export async function signOutUser() {
  return signOut(auth);
}
