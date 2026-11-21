import React, { useEffect, useState } from 'react';
import { GoogleAuthProvider } from 'firebase/auth';
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, Users } from 'lucide-react';
import { formatFirebaseAuthError, signInWithGoogle } from '../firebase';

interface BridgeParams {
  mode: 'backend' | 'loopback';
  sessionId: string;
  loopbackPort: string;
  writeSecret: string;
}

function readBridgeParams(): BridgeParams {
  const search = new URLSearchParams(window.location.search);
  const authBridge = search.get('authBridge') || '';
  const port = search.get('port') || '';

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const ws = hashParams.get('ws') || search.get('ws') || '';

  return {
    mode: authBridge === 'loopback' ? 'loopback' : 'backend',
    sessionId: authBridge,
    loopbackPort: port,
    writeSecret: ws,
  };
}

export const AuthBridgeView: React.FC = () => {
  const [params] = useState<BridgeParams>(() => readBridgeParams());
  const [status, setStatus] = useState<'ready' | 'working' | 'done' | 'error'>('ready');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [signedEmail, setSignedEmail] = useState<string | null>(null);

  useEffect(() => {
    // Strip secret fragment from browser URL bar immediately after capturing in state
    if (window.location.hash) {
      try {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}`
        );
      } catch {
        // ignore history error
      }
    }
  }, []);

  const postFailure = async (message: string) => {
    try {
      if (params.mode === 'loopback' && params.loopbackPort) {
        await fetch(`http://127.0.0.1:${encodeURIComponent(params.loopbackPort)}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            writeSecret: params.writeSecret,
            error: message,
          }),
        });
      } else if (params.mode === 'backend' && params.sessionId) {
        await fetch(`/api/auth/session/${encodeURIComponent(params.sessionId)}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            writeSecret: params.writeSecret,
            error: message,
          }),
        });
      }
    } catch {
      // ignore reporting errors
    }
  };

  const handleConfirmGoogle = async () => {
    if (!params.writeSecret) {
      setStatus('error');
      setErrorMsg('لینک احراز هویت ناقص است؛ لطفاً از داخل برنامه دوباره تلاش کنید.');
      return;
    }

    setStatus('working');
    setErrorMsg(null);

    try {
      const result = await signInWithGoogle();
      const oauthCred = GoogleAuthProvider.credentialFromResult(result);
      const googleIdToken = oauthCred?.idToken;
      const googleAccessToken = oauthCred?.accessToken;
      const firebaseIdToken = await result.user.getIdToken();

      if (!googleIdToken && !googleAccessToken) {
        throw new Error('توکن احراز هویت گوگل دریافت نشد.');
      }

      const payload = {
        writeSecret: params.writeSecret,
        googleIdToken,
        googleAccessToken,
        firebaseIdToken,
        email: result.user.email || undefined,
        displayName: result.user.displayName || undefined,
      };

      const endpoint =
        params.mode === 'loopback'
          ? `http://127.0.0.1:${encodeURIComponent(params.loopbackPort)}/complete`
          : `/api/auth/session/${encodeURIComponent(params.sessionId)}/complete`;

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        let serverErr = `خطا در ارسال اطلاعات ورود به برنامه (${resp.status})`;
        try {
          const data = (await resp.json()) as { error?: string };
          if (data?.error) serverErr = data.error;
        } catch {
          // ignore
        }
        throw new Error(serverErr);
      }

      setSignedEmail(result.user.email || result.user.displayName || 'کاربر گوگل');
      setStatus('done');
    } catch (err) {
      const readable = formatFirebaseAuthError(err);
      setStatus('error');
      setErrorMsg(readable);
      void postFailure(readable);
    }
  };

  return (
    <div className="ambient-shell min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--ink-faint)] rounded-2xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-[var(--ink-faint)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] grid place-items-center font-black text-xl shrink-0 shadow-[0_0_20px_var(--accent-soft)]">
            ر
          </div>
          <div>
            <h1 className="text-lg font-black leading-tight">اتصال امن حساب گوگل</h1>
            <p className="text-xs text-[var(--ink-muted)]">
              درگاه ورود نسخه دسکتاپ (ویندوز) و موبایل (اندروید)
            </p>
          </div>
        </div>

        {status === 'done' ? (
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-emerald-500/15 border border-emerald-500/40 text-sm leading-7 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-1" />
              <div>
                <p className="font-bold text-emerald-300">ورود با موفقیت انجام شد</p>
                <p className="text-xs text-[var(--ink-muted)] mt-1">
                  حساب <span className="mono font-bold text-[var(--ink)]">{signedEmail}</span> به
                  برنامه «روان‌سنج صنعتی» متصل شد. اکنون می‌توانید این تب مرورگر را ببندید و به
                  برنامه برگردید.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.close()}
              className="w-full py-2.5 px-4 rounded-lg font-bold bg-[var(--ink-faint)] hover:border-[var(--accent)]/50 border border-[var(--ink-faint)] text-xs cursor-pointer"
            >
              بستن این صفحه
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs leading-6 text-[var(--ink-muted)]">
              برای جلوگیری از مسدودسازی ورود گوگل در محیط‌های دسکتاپ و اندروید، احراز هویت از
              طریق مرورگر اصلی انجام می‌شود و نشست ابری به‌صورت خودکار در برنامه فعال خواهد شد.
            </p>

            {status === 'error' && errorMsg && (
              <div className="rounded-xl p-3 bg-[#fef2f2] dark:bg-[#450a0a]/60 border border-[#dc2626]/40 dark:border-[#f87171]/40 text-xs font-medium flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="button"
              disabled={status === 'working'}
              onClick={handleConfirmGoogle}
              className="w-full py-3 px-4 rounded-lg font-bold bg-[var(--accent)] text-[var(--accent-fg)] shadow-[0_4px_12px_var(--accent-soft)] hover:opacity-95 disabled:opacity-60 cursor-pointer text-sm flex items-center justify-center gap-2"
            >
              {status === 'working' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال اتصال به گوگل…</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>تأیید و ورود با حساب گوگل</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
