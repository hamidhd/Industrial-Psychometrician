import React from 'react';
import { ALL_TESTS, BATTERIES, faDigits, FINAL, testById } from '../data/tests';
import type { AnyTestDef } from '../types/psychometrics';
import { ToneTag } from './DimensionDisplay';

function BandsTable({ test }: { test: AnyTestDef }) {
  if (test.type === 'q') {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[520px]">
          <thead>
            <tr className="bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8]">
              <th className="text-right p-2.5 font-medium">مقیاس</th>
              <th className="text-right p-2.5 font-medium">سطح (بازه‌ی نمره)</th>
              <th className="text-right p-2.5 font-medium">تفسیر</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(test.dims).map((k) => {
              const n = test.items.filter((i) => i[1] === k).length;
              const mult = test.mult || 1;
              let lo = n * test.scale.min * mult;
              return test.dims[k].bands.map((b, i) => {
                const from = lo;
                const to = b.upTo >= FINAL ? n * test.scale.max * mult : b.upTo;
                lo = to + 1;
                return (
                  <tr
                    key={`${k}-${i}`}
                    className="border-b border-[#d5dce1] dark:border-[#33414d] align-top"
                  >
                    {i === 0 && (
                      <td
                        rowSpan={test.dims[k].bands.length}
                        className="p-2.5 font-bold whitespace-nowrap"
                      >
                        {test.dims[k].name}
                      </td>
                    )}
                    <td className="p-2.5 whitespace-nowrap">
                      <ToneTag tone={b.tone} label={b.label} />{' '}
                      <span className="num-ltr text-xs mr-1">
                        {from}–{to}
                      </span>
                    </td>
                    <td className="p-2.5 text-xs text-[#5a6a78] dark:text-[#9aabb8]">{b.text}</td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const normsMap: Record<string, Array<[string, string]>> = {
    reaction: [
      [
        'میانگین واکنش',
        '≤۲۵۰ عالی · ۲۵۱–۳۲۰ طبیعی · ۳۲۱–۴۰۰ کند · بیش از ۴۰۰ بسیار کند (میلی‌ثانیه)',
      ],
      ['نوسان', '≤۴۰ پایدار · ≤۸۰ متوسط · بیشتر ناپایدار'],
      ['پیش‌دستی', '۰ طبیعی · ۱–۲ گاهی · ۳ و بیشتر زیاد'],
    ],
    stroop: [
      ['اثر تداخل', '≤۱۵۰ خوب · ≤۲۵۰ متوسط · بیشتر بالا (میلی‌ثانیه)'],
      ['دقت ناهمخوان', '≥۹۴٪ بالا · ≥۸۵٪ متوسط · کمتر پایین'],
    ],
    digits: [
      ['مستقیم', '≤۴ پایین · ۵–۶ متوسط · ≥۷ خوب'],
      ['معکوس', '≤۳ پایین · ۴ متوسط · ≥۵ خوب'],
    ],
    trail: [
      ['بخش الف', '≤۳۰ ثانیه سریع · ≤۵۰ متوسط · بیشتر کند'],
      ['بخش ب', '≤۷۵ ثانیه سریع · ≤۱۲۰ متوسط · بیشتر کند'],
      ['خطا', '≤۲ کم · ≤۵ متوسط · بیشتر زیاد'],
    ],
  };

  const rows = normsMap[test.id] || [];

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm min-w-[460px]">
          <thead>
            <tr className="bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8]">
              <th className="text-right p-2.5 font-medium">شاخص</th>
              <th className="text-right p-2.5 font-medium">مرزها (تقریبی)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-b border-[#d5dce1] dark:border-[#33414d]">
                <td className="p-2.5 font-semibold whitespace-nowrap">{r[0]}</td>
                <td className="p-2.5 text-xs">{r[1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mt-2">
        مرزها تقریبی و بر پایه‌ی یافته‌های رایج است و برای نمونه‌ی ایرانی/کارخانه‌ی شما هنجاریابی
        نشده است. پس از ثبت نتایج چند ده نفر از کارکنان خودتان، میانگین واحد را مبنای مقایسه قرار
        دهید.
      </p>
    </div>
  );
}

export const HelpView: React.FC = () => {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">راهنما و تفسیر</h1>
      <p className="text-sm text-[#5a6a78] dark:text-[#9aabb8] mb-5">
        نحوه‌ی اجرا، نمره‌گذاری و تفسیر هر آزمون، همراه با اصول اخلاقی، کاربرد در محیط صنعتی و
        راه‌اندازی چندرایانه‌ای.
      </p>

      <div className="space-y-3">
        <details
          open
          className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c]"
        >
          <summary className="cursor-pointer px-4 py-3 font-bold">
            ۱) روند کار پیشنهادی (چند رایانه با پایگاه داده مشترک)
          </summary>
          <div className="px-4 pb-4 text-sm space-y-2">
            <ol className="list-decimal pr-5 space-y-1.5">
              <li>
                <b>اتصال رایانه‌ها:</b> روی تمام رایانه‌ها با حساب گوگل مشترک وارد شوید یا مالک
                پایگاه داده در «تنظیمات و اشتراک‌گذاری» ایمیل گوگل همکاران را به فهرست مجاز اضافه
                کند.
              </li>
              <li>
                <b>ثبت فرد:</b> در «پرسنل و داوطلبان» فرد را ثبت و رضایت آگاهانه را علامت بزنید
                (فوراً در تمام رایانه‌ها دیده می‌شود).
              </li>
              <li>
                <b>انتخاب بسته:</b> در «اجرای آزمون» بسته‌ی متناسب با شغل را برگزینید (جدول بخش ۴).
              </li>
              <li>
                <b>اجرا:</b> فرد روی هر رایانه آزمون‌ها را پشت‌سر هم انجام می‌دهد. نمره‌گذاری
                خودکار است و نام ایستگاه/رایانه کنار نتیجه ثبت می‌شود.
              </li>
              <li>
                <b>تفسیر و گزارش:</b> در «نتایج و گزارش» روی رایانه‌ی روان‌شناس یا HSE نتیجه را
                ببینید، موارد نیازمند توجه را بررسی کنید و گزارش کامل را چاپ یا PDF بگیرید.
              </li>
              <li>
                <b>پشتیبان:</b> هر چند وقت یک‌بار از «تنظیمات» فایل پشتیبان JSON بگیرید.
              </li>
            </ol>
          </div>
        </details>

        <details className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c]">
          <summary className="cursor-pointer px-4 py-3 font-bold">
            ۲) اصول اخلاقی و حقوقی (پیش از هر آزمون بخوانید)
          </summary>
          <div className="px-4 pb-4 text-sm">
            <ul className="list-disc pr-5 space-y-1.5">
              <li>
                رضایت آگاهانه: هدف آزمون، نحوه‌ی استفاده از نتیجه، و اینکه چه کسی نتیجه را می‌بیند
                را به فرد بگویید.
              </li>
              <li>
                محرمانگی: نتایج فقط در اختیار افراد مجاز (روان‌شناس، پزشک طب کار، مسئول منابع انسانی
                در حد لزوم) قرار گیرد؛ به سرپرست مستقیم نمره‌ی خام ندهید، فقط توصیه‌ی کاربردی
                بدهید.
              </li>
              <li>
                کاربرد درست: نتایج برای «کمک به تصمیم» و «شناخت نیاز آموزشی و حمایتی» است، نه
                برچسب‌زدن، تنبیه یا اخراج.
              </li>
              <li>
                تصمیم استخدام هرگز نباید فقط بر پایه‌ی یک آزمون باشد؛ مصاحبه‌ی ساختاریافته، سوابق
                و تست مهارت را هم لحاظ کنید.
              </li>
              <li>
                پرسشنامه‌ی سلامت روان (DASS-21) برای غربالگری استخدام توصیه نمی‌شود؛ برای پایش و
                حمایت از شاغلین مناسب‌تر است.
              </li>
              <li>
                اگر نشانه‌ی خطر جدی دیده شد (هشدار قرمز)، همان روز با فرد به‌صورت محرمانه و همدلانه
                گفت‌وگو و ارجاع تخصصی را هماهنگ کنید.
              </li>
              <li>
                تشخیص بالینی و تفسیر تخصصی بر عهده‌ی روان‌شناس یا روان‌پزشک است؛ این برنامه جایگزین
                آنها نیست.
              </li>
              <li>
                قوانین کار و قوانین حفاظت از اطلاعات شخصی را رعایت کنید؛ به‌ویژه برای ذخیره‌ی
                طولانی‌مدت اطلاعات داوطلبان رد شده.
              </li>
            </ul>
          </div>
        </details>

        <details className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c]">
          <summary className="cursor-pointer px-4 py-3 font-bold">
            ۳) آزمون‌ها: نحوه‌ی اجرا و تفسیر
          </summary>
          <div className="px-4 pb-4 space-y-2">
            {ALL_TESTS.map((t) => (
              <details
                key={t.id}
                className="rounded-lg border border-[#d5dce1] dark:border-[#33414d] bg-[#f4f6f7]/50 dark:bg-[#222d36]/40"
              >
                <summary className="cursor-pointer px-3.5 py-2.5 font-bold text-sm">
                  {t.title}{' '}
                  <span className="text-xs font-normal text-[#5a6a78] dark:text-[#9aabb8] mr-2">
                    {t.type === 'q' ? 'پرسشنامه' : 'عملکردی'} · حدود {faDigits(t.minutes)} دقیقه
                  </span>
                </summary>
                <div className="px-3.5 pb-3.5 text-sm space-y-3">
                  <dl className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-y-2 gap-x-3">
                    <dt className="text-[#5a6a78] dark:text-[#9aabb8] font-medium">
                      چه چیزی می‌سنجد
                    </dt>
                    <dd>{t.guide.measures}</dd>
                    <dt className="text-[#5a6a78] dark:text-[#9aabb8] font-medium">نحوه‌ی اجرا</dt>
                    <dd>
                      <ul className="list-disc pr-5 space-y-1">
                        {t.guide.admin.map((x, idx) => (
                          <li key={idx}>{x}</li>
                        ))}
                      </ul>
                    </dd>
                    <dt className="text-[#5a6a78] dark:text-[#9aabb8] font-medium">کاربرد مناسب</dt>
                    <dd>
                      <ul className="list-disc pr-5 space-y-1">
                        {t.guide.use.map((x, idx) => (
                          <li key={idx}>{x}</li>
                        ))}
                      </ul>
                    </dd>
                    <dt className="text-[#5a6a78] dark:text-[#9aabb8] font-medium">محدودیت‌ها</dt>
                    <dd>
                      <ul className="list-disc pr-5 space-y-1">
                        {t.guide.limits.map((x, idx) => (
                          <li key={idx}>{x}</li>
                        ))}
                      </ul>
                    </dd>
                  </dl>
                  <div>
                    <h3 className="font-bold text-sm mb-2">جدول تفسیر نمرات</h3>
                    <BandsTable test={t} />
                  </div>
                </div>
              </details>
            ))}
          </div>
        </details>

        <details className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c]">
          <summary className="cursor-pointer px-4 py-3 font-bold">
            ۴) بسته‌های پیشنهادی بر اساس شغل
          </summary>
          <div className="px-4 pb-4 text-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm min-w-[520px]">
                <thead>
                  <tr className="bg-[#f4f6f7] dark:bg-[#222d36] text-[#5a6a78] dark:text-[#9aabb8]">
                    <th className="text-right p-2.5 font-medium">گروه شغلی</th>
                    <th className="text-right p-2.5 font-medium">آزمون‌ها</th>
                    <th className="text-right p-2.5 font-medium">توضیح</th>
                  </tr>
                </thead>
                <tbody>
                  {BATTERIES.map((b, i) => (
                    <tr key={i} className="border-b border-[#d5dce1] dark:border-[#33414d]">
                      <td className="p-2.5 font-bold">{b.name}</td>
                      <td className="p-2.5 text-xs">
                        {b.tests.map((id) => testById(id).short).join('، ')}
                      </td>
                      <td className="p-2.5 text-xs text-[#5a6a78] dark:text-[#9aabb8]">
                        {b.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#5a6a78] dark:text-[#9aabb8] mt-2">
              بسته‌ها پیشنهادی‌اند؛ بر اساس شرح شغل و تحلیل خطرات پست، آنها را کم یا زیاد کنید.
              زمان کل یک بسته ۲۰ تا ۳۰ دقیقه است؛ بهتر است در دو نوبت اجرا شود تا خستگی نمره‌ها را
              مخدوش نکند.
            </p>
          </div>
        </details>

        <details className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c]">
          <summary className="cursor-pointer px-4 py-3 font-bold">
            ۵) تفسیر ترکیبی (الگوهای مهم)
          </summary>
          <div className="px-4 pb-4 text-sm">
            <ul className="list-disc pr-5 space-y-1.5">
              <li>
                وظیفه‌شناسی پایین + ریسک‌پذیری بالا + پایبندی ضعیف به مقررات: الگوی پرخطر برای مشاغل
                ایمنی‌محور (برق، ارتفاع، جرثقیل). مصاحبه‌ی رفتاری، آموزش و نظارت نزدیک یا انتخاب شغل
                کم‌خطرتر.
              </li>
              <li>
                خستگی بالا + زمان واکنش کند یا نوسان زیاد: بررسی خواب و برنامه‌ی شیفت؛ در صورت
                چرت‌زدن حین کار یا رانندگی، ارجاع به پزشک طب کار و محدودیت موقت کار پرخطر.
              </li>
              <li>
                استرس/اضطراب بالا (DASS) + ناپایداری هیجانی بالا: فشار روانی احتمالی؛ بازبینی بار
                کاری، مشاوره‌ی کارکنان و بررسی عوامل غیرکاری. نباید این الگو را تنها دلیل عدم
                استخدام دانست.
              </li>
              <li>
                فرسودگی بالا + کارآمدی پایین: بیشتر نشانه‌ی عوامل سازمانی (بار کار، عدالت، قدردانی)
                است؛ نتایج واحد را گروهی مرور کنید.
              </li>
              <li>
                مقیاس روایی «مشکوک»: نمرات خودگزارشی قابل اتکا نیست؛ آزمون را با توضیح مجدد و محیط
                آرام‌تر تکرار یا بر مصاحبه و سوابق تکیه کنید.
              </li>
              <li>
                نمرات پایین در تمام آزمون‌های عملکردی: ابتدا شرایط (بی‌خوابی، دارو، ناآشنایی با
                رایانه، بینایی، کم‌سوادی، اضطراب آزمون) را بررسی و آزمون را در روز دیگر تکرار کنید.
              </li>
              <li>
                در تعارض آزمون و مصاحبه: مصاحبه و مشاهده‌ی عملی را مقدم بدانید و علت اختلاف را
                جست‌وجو کنید.
              </li>
            </ul>
          </div>
        </details>

        <details className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c]">
          <summary className="cursor-pointer px-4 py-3 font-bold">
            ۶) شرایط اجرا برای نتایج معتبر
          </summary>
          <div className="px-4 pb-4 text-sm">
            <ul className="list-disc pr-5 space-y-1.5">
              <li>اتاق ساکت، نور مناسب، بدون رفت‌وآمد؛ همان دستگاه برای همه‌ی افراد گروه.</li>
              <li>
                برای آزمون‌های عملکردی ماوس یا صفحه‌ی لمسی ثابت؛ مانیتور با رنگ‌های استاندارد.
              </li>
              <li>پرهیز از اجرا بلافاصله پس از شیفت شب، دعوای کاری، یا خبر ناراحت‌کننده.</li>
              <li>فرد دارای عینک یا سمعک آن را همراه داشته باشد.</li>
              <li>
                دوباره‌خوانی گویه‌ها برای افراد کم‌سواد با خواندن بدون القای پاسخ توسط ارزیاب ممکن
                است؛ این موضوع را در گزارش ثبت کنید.
              </li>
              <li>برای مقایسه‌ی نتایج چند ماه بعد از همان شرایط تقریباً مشابه استفاده کنید.</li>
            </ul>
          </div>
        </details>

        <details className="rounded-[10px] border border-[#d5dce1] dark:border-[#33414d] bg-white dark:bg-[#1b242c]">
          <summary className="cursor-pointer px-4 py-3 font-bold">۷) پرسش‌های متداول</summary>
          <div className="px-4 pb-4 text-sm space-y-3">
            <p>
              <b>آیا نمره‌ی پایین یعنی فرد مناسب نیست؟</b>
              <br />
              خیر. نمره‌ها شاخص‌اند. تناسب فرد با شغل، آموزش و شرایط کار نیز مهم است.
            </p>
            <p>
              <b>داده‌ها کجا ذخیره می‌شود و چگونه روی چند رایانه مشترک است؟</b>
              <br />
              اطلاعات در پایگاه داده ابری مشترک (Cloud Firestore) ذخیره می‌شود و به‌صورت زنده روی
              تمام رایانه‌های مجاز همگام‌سازی می‌گردد. اگر از نسخه‌ی تک‌رایانه‌ی قبلی استفاده
              می‌کردید، می‌توانید از بخش «تنظیمات و پشتیبان» داده‌های قبلی یا فایل پشتیبان JSON را
              وارد پایگاه داده مشترک کنید.
            </p>
            <p>
              <b>این آزمون‌ها با آزمون‌های معتبر معروف (مانند MMPI یا NEO) چه تفاوتی دارند؟</b>
              <br />
              آن آزمون‌ها حق‌نشر و صلاحیت تفسیر تخصصی دارند. این برنامه از ابزارهای آزاد و گویه‌های
              اصل استفاده می‌کند و برای غربالگری و بحث در مصاحبه مناسب است، نه جایگزین آنها.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
};
