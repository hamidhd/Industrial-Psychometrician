import React, { useState } from 'react';
import { MonitorCheck, ShieldCheck } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface Props {
  unverifiedEmail?: string | null;
  onSignOut?: () => void;
}

export const AuthGate: React.FC<Props> = ({ unverifiedEmail, onSignOut }) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleLogin = async () => {
    setBusy(true);
    setErr(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('popup-closed-by-user')) {
        setErr('پنجره‌ی ورود بسته شد. دوباره تلاش کنید.');
      } else {
        setErr('خطا در ورود با گوگل. لطفاً مسدودکننده‌ی پاپ‌آپ را بررسی کنید و دوباره بزنید.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#edf0f2] dark:bg-[#12181e]">
      <div className="w-full max-w-lg bg-white dark:bg-[#1b242c] border border-[#d5dce1] dark:border-[#33414d] rounded-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-[10px] bg-[#0e6a88] text-white grid place-items-center font-extrabold text-xl shrink-0">
            ر
          </div>
          <div>
            <h1 className="text-xl font-extrabold leading-tight">روان‌سنج صنعتی</h1>
            <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8]">
              سامانه چندرایانه‌ای آزمون‌های روان‌شناختی محیط کار
            </p>
          </div>
        </div>

        {unverifiedEmail ? (
          <div className="space-y-4">
            <div className="rounded-lg p-3.5 bg-[#fde6d2] dark:bg-[#41290f] border border-[#b4560f] text-sm">
              <b>تأیید ایمیل لازم است</b>
              <p className="mt-1">
                ایمیل <span className="num-ltr font-semibold">{unverifiedEmail}</span> هنوز تأیید
                نشده است. برای حفظ محرمانگی پرونده‌های روان‌شناختی، فقط حساب‌های تأییدشده مجاز به
                دسترسی به پایگاه داده مشترک هستند.
              </p>
            </div>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full py-2.5 px-4 rounded-lg font-bold border border-[#d5dce1] dark:border-[#33414d] cursor-pointer"
              >
                خروج و ورود با حساب دیگر
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-[#1b2733] dark:text-[#e6ecf0] leading-7">
              این نسخه به پایگاه داده ابری مشترک متصل است تا چند رایانه در واحد ایمنی (HSE)، طب کار
              و منابع انسانی بتوانند هم‌زمان پرونده‌ها را ثبت، آزمون‌ها را اجرا و نتایج را مشاهده
              کنند.
            </p>

            <div className="space-y-2.5 border-y border-[#d5dce1] dark:border-[#33414d] py-4 text-xs text-[#5a6a78] dark:text-[#9aabb8]">
              <div className="flex items-start gap-2.5">
                <MonitorCheck className="w-4 h-4 text-[#0e6a88] dark:text-[#4fb4d4] shrink-0 mt-0.5" />
                <span>
                  همگام‌سازی زنده بین چند رایانه: ورود با یک حساب مشترک یا افزودن ایمیل همکاران در
                  تنظیمات پایگاه داده.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#23804f] dark:text-[#5cc78d] shrink-0 mt-0.5" />
                <span>
                  دسترسی ایزوله و امن: داده‌ها فقط برای مالک و ایمیل‌های مجازِ تعریف‌شده در پایگاه
                  داده قابل مشاهده است.
                </span>
              </div>
            </div>

            {err && (
              <div className="rounded-lg p-3 bg-[#fbdcdc] dark:bg-[#431c1c] border border-[#b83232] text-xs font-medium">
                {err}
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={handleLogin}
              className="w-full py-3 px-4 rounded-lg font-bold bg-[#0e6a88] text-white hover:opacity-95 disabled:opacity-60 cursor-pointer transition-opacity"
            >
              {busy ? 'در حال اتصال…' : 'ورود با حساب گوگل و اتصال به پایگاه داده'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
