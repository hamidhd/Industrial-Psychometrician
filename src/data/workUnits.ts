import type {
  OccupationalCategoryId,
  TestId,
  TestResult,
  WorkSettingType,
} from '../types/psychometrics';

export function normalizeFa(s: string): string {
  return String(s ?? '')
    .replace(/\u06BE/g, 'ه') // Arabic Heh Doachashmee -> Persian Heh
    .replace(/\u064A/g, 'ی') // Arabic Yeh -> Persian Yeh
    .replace(/\u0643/g, 'ک') // Arabic Kaf -> Persian Kaf
    .replace(/\u200C/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface RiasecProfile {
  R: number; // Realistic (عملی/میدانی/فنی)
  I: number; // Investigative (تحلیلی/آزمایشگاهی)
  A: number; // Artistic (طراحی/خلاق)
  S: number; // Social (اجتماعی/آموزش/خدمات/ایمنی)
  E: number; // Enterprising (مدیریتی/فروش/بازرگانی)
  C: number; // Conventional (اداری/پشت‌میزی/مالی/آمار)
}

export interface BigFiveAffinity {
  C?: number; // Conscientiousness weight (0..1)
  E?: number; // Extraversion target (0..1)
  O?: number; // Openness target (0..1)
  A?: number; // Agreeableness target (0..1)
  S?: number; // Emotional Stability (1 - N) weight (0..1)
}

export const WORK_SETTING_LABEL: Record<WorkSettingType, string> = {
  field: 'میدانی و خط تولید',
  technical: 'فنی، کارگاهی و میدانی تخصصی',
  desk: 'پشت‌میزی، ستادی و مالی',
  lab: 'آزمایشگاهی، تحلیلی و کنترل کیفیت',
  leadership: 'مدیریتی، سرپرستی و بازرگانی',
  support: 'میدانی-نظارتی، ایمنی و پشتیبانی',
};

export interface OccupationalCategoryDef {
  id: OccupationalCategoryId;
  title: string;
  shortTitle: string;
  workSetting: WorkSettingType;
  workSettingLabel: string;
  description: string;
  recommendedTests: TestId[];
  riasecIdeal: RiasecProfile;
  bigFiveIdeal: BigFiveAffinity;
}

export interface WorkUnitDef {
  name: string;
  categoryId: OccupationalCategoryId;
  workSetting: WorkSettingType;
  workSettingLabel: string;
  description: string;
  riasecIdeal: RiasecProfile;
  isCustom?: boolean;
}

const CUSTOM_UNITS_STORAGE_KEY = 'rsi_custom_work_units_v1';

export const OCCUPATIONAL_CATEGORIES: OccupationalCategoryDef[] = [
  {
    id: 'production',
    title: 'خطوط تولید، برش و بسته‌بندی',
    shortTitle: 'تولید و بهره‌برداری',
    workSetting: 'field',
    workSettingLabel: WORK_SETTING_LABEL.field,
    description:
      'فعالیت عملی و مستقیم در سالن‌های تولید (نورد سرد، اسیدشویی، گالوانیزه، برش، بسته‌بندی و رنگ)؛ نیازمند هوشیاری، ثبات هیجانی، پایبندی ایمنی و تحمل کار عملی.',
    recommendedTests: ['riasec', 'ipip', 'safety', 'fatigue', 'reaction', 'stroop'],
    riasecIdeal: { R: 92, I: 35, A: 20, S: 38, E: 32, C: 58 },
    bigFiveIdeal: { C: 0.78, E: 0.45, O: 0.35, A: 0.6, S: 0.78 },
  },
  {
    id: 'technical',
    title: 'فنی، مهندسی و نگهداری و تعمیرات (نت)',
    shortTitle: 'فنی و تعمیرات',
    workSetting: 'technical',
    workSettingLabel: WORK_SETTING_LABEL.technical,
    description:
      'عیب‌یابی و نگهداری تجهیزات صنعتی (برق، الکترونیک، هیدرولیک، تاسیسات، ماشین‌سازی، CNC و جوشکاری)؛ ترکیب بالای علاقه عملی-فنی و تحلیل مسئله.',
    recommendedTests: ['riasec', 'ipip', 'safety', 'digits', 'trail', 'reaction'],
    riasecIdeal: { R: 90, I: 82, A: 30, S: 32, E: 35, C: 55 },
    bigFiveIdeal: { C: 0.8, E: 0.42, O: 0.68, A: 0.55, S: 0.75 },
  },
  {
    id: 'quality',
    title: 'کنترل کیفیت، آزمایشگاه و تحقیق و توسعه',
    shortTitle: 'کیفیت و آزمایشگاه',
    workSetting: 'lab',
    workSettingLabel: WORK_SETTING_LABEL.lab,
    description:
      'آزمون‌های متالورژی و شیمیایی، کالیبراسیون ابزار دقیق، بازرسی فنی و تحقیق و توسعه؛ نیازمند تمرکز تحلیلی، دقت در ثبت داده و توجه انتخابی.',
    recommendedTests: ['riasec', 'ipip', 'integrity', 'stroop', 'digits', 'trail'],
    riasecIdeal: { R: 52, I: 90, A: 32, S: 35, E: 30, C: 82 },
    bigFiveIdeal: { C: 0.88, E: 0.38, O: 0.72, A: 0.58, S: 0.72 },
  },
  {
    id: 'logistics',
    title: 'انبارها، لجستیک و ترابری صنعتی',
    shortTitle: 'انبار و لیفتراک',
    workSetting: 'field',
    workSettingLabel: 'میدانی و کنترل موجودی',
    description:
      'انبار مواد اولیه، انبار قطعات و عملیات لیفتراک؛ ترکیب کار میدانی منظم، مسئولیت‌پذیری امانت‌داری و هوشیاری دیداری-حرکتی.',
    recommendedTests: ['riasec', 'ipip', 'safety', 'integrity', 'fatigue', 'reaction'],
    riasecIdeal: { R: 78, I: 30, A: 18, S: 38, E: 38, C: 78 },
    bigFiveIdeal: { C: 0.82, E: 0.45, O: 0.35, A: 0.62, S: 0.75 },
  },
  {
    id: 'office',
    title: 'اداری، مالی، آمار، برنامه‌ریزی و انفورماتیک',
    shortTitle: 'اداری و پشت‌میزی',
    workSetting: 'desk',
    workSettingLabel: WORK_SETTING_LABEL.desk,
    description:
      'کار پشت‌میزی، اسنادی، نرم‌افزاری و محاسباتی در دفتر مدیریت، مالی و صندوق، آمار و برنامه‌ریزی، آموزش و انفورماتیک؛ نیازمند دقت ساختاریافته و درست‌کاری.',
    recommendedTests: ['riasec', 'ipip', 'integrity', 'burnout', 'digits', 'trail'],
    riasecIdeal: { R: 22, I: 68, A: 28, S: 45, E: 48, C: 94 },
    bigFiveIdeal: { C: 0.86, E: 0.48, O: 0.56, A: 0.64, S: 0.7 },
  },
  {
    id: 'commercial',
    title: 'مدیریت ارشد، فروش و بازرگانی',
    shortTitle: 'مدیریت و بازرگانی',
    workSetting: 'leadership',
    workSettingLabel: WORK_SETTING_LABEL.leadership,
    description:
      'هدایت سازمان، مذاکره، فروش و تأمین بازرگانی؛ ترکیبی از کار پشت‌میزی و جلسات میدانی-ارتباطی با غلبه برون‌گرایی، متهوربودن و تصمیم‌گیری.',
    recommendedTests: ['riasec', 'ipip', 'integrity', 'burnout', 'dass', 'trail'],
    riasecIdeal: { R: 25, I: 50, A: 35, S: 72, E: 95, C: 68 },
    bigFiveIdeal: { C: 0.78, E: 0.85, O: 0.7, A: 0.62, S: 0.82 },
  },
  {
    id: 'safety_support',
    title: 'ایمنی و بهداشت (HSE)، انتظامات و خدمات',
    shortTitle: 'HSE، انتظامات و خدمات',
    workSetting: 'support',
    workSettingLabel: WORK_SETTING_LABEL.support,
    description:
      'حفاظت صنعتی، ایمنی و بهداشت کار، خدمات رفاهی و آشپزخانه؛ نیازمند مسئولیت‌پذیری اجتماعی، نظارت میدانی، درست‌کاری و پایبندی به مقررات.',
    recommendedTests: ['riasec', 'ipip', 'safety', 'integrity', 'fatigue', 'dass'],
    riasecIdeal: { R: 62, I: 40, A: 22, S: 85, E: 48, C: 65 },
    bigFiveIdeal: { C: 0.8, E: 0.62, O: 0.45, A: 0.75, S: 0.8 },
  },
];

// Standard organizational & industrial work units (customizable per organization)
export const DEFAULT_WORK_UNITS: WorkUnitDef[] = [
  // Production & Operations
  {
    name: 'تولید گالوانیزه',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / خط تولید پیوسته',
    description: 'اپراتوری خطوط گالوانیزه، کنترل کشش، کوره و پوشش روی',
    riasecIdeal: { R: 94, I: 36, A: 18, S: 38, E: 30, C: 56 },
  },
  {
    name: 'تولید گالوانیزه و رنگی',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / خط تولید و پوشش رنگ',
    description: 'اپراتوری خط رنگ و گالوانیزه، دقت در ثبات کیفیت سطح',
    riasecIdeal: { R: 90, I: 40, A: 38, S: 38, E: 30, C: 58 },
  },
  {
    name: 'تولید نورد سرد',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / خط تولید سنگین',
    description: 'اپراتوری قفسه‌های نورد سرد، کنترل ضخامت و ایمنی ماشین‌آلات',
    riasecIdeal: { R: 95, I: 42, A: 15, S: 35, E: 32, C: 58 },
  },
  {
    name: 'تولید نورد سرد و اسید شویی',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / خط تولید و فرآیند شیمیایی',
    description: 'اپراتوری ترکیبی نورد و وان‌های اسیدشویی با حساسیت ایمنی بالا',
    riasecIdeal: { R: 92, I: 45, A: 15, S: 36, E: 30, C: 60 },
  },
  {
    name: 'تولید اسید شویی',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / خط تولید شیمیایی',
    description: 'کنترل وان‌های اسید، شست‌وشو و زدودن اکسید با تجهیزات حفاظت فردی',
    riasecIdeal: { R: 90, I: 48, A: 15, S: 36, E: 28, C: 62 },
  },
  {
    name: 'برش',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / خط برش و آماده‌سازی',
    description: 'تنظیم تیغه‌ها، خط نواربری و طول‌بری دقیق ورق‌های فولادی',
    riasecIdeal: { R: 90, I: 38, A: 20, S: 34, E: 30, C: 64 },
  },
  {
    name: 'بسته بندی',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / بسته‌بندی و آماده‌سازی ارسال',
    description: 'بسته‌بندی کویل و شیت، لیبل‌زنی و رعایت نظم تحویل محصول',
    riasecIdeal: { R: 84, I: 22, A: 18, S: 42, E: 30, C: 68 },
  },
  {
    name: 'برش و بسته بندی',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / برش و بسته‌بندی',
    description: 'عملیات هماهنگ خط برش و بسته‌بندی نهایی محصول',
    riasecIdeal: { R: 88, I: 30, A: 18, S: 38, E: 30, C: 66 },
  },
  {
    name: 'نقاشی',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / رنگ‌آمیزی صنعتی',
    description: 'آماده‌سازی سطوح و اجرای پوشش‌های صنعتی و ساختمانی',
    riasecIdeal: { R: 85, I: 28, A: 58, S: 35, E: 25, C: 50 },
  },
  {
    name: 'بهره برداری',
    categoryId: 'production',
    workSetting: 'field',
    workSettingLabel: 'میدانی / راهبری تولید',
    description: 'هماهنگی و راهبری فرآیندهای خط تولید و بهره‌وری شیفت',
    riasecIdeal: { R: 86, I: 45, A: 20, S: 48, E: 55, C: 64 },
  },

  // Technical, Engineering & Maintenance
  {
    name: 'فنی و مهندسی',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'ترکیبی (پشت‌میزی طراحی + میدانی نظارت فنی)',
    description: 'طراحی مهندسی، بهبود خطوط، نقشه‌خوانی و نظارت فنی پروژه',
    riasecIdeal: { R: 74, I: 92, A: 42, S: 38, E: 48, C: 65 },
  },
  {
    name: 'تاسیسات',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-میدانی / تاسیسات سازمان',
    description: 'نگهداری سیستم‌های آب، بخار، کمپرسور، تهویه و تاسیسات ساختمانی و صنعتی',
    riasecIdeal: { R: 94, I: 65, A: 20, S: 35, E: 32, C: 54 },
  },
  {
    name: 'برق',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-میدانی / برق صنعتی و تابلو',
    description: 'عیب‌یابی تابلوهای قدرت، موتورها و ایمنی کار با ولتاژ بالا',
    riasecIdeal: { R: 92, I: 80, A: 22, S: 32, E: 34, C: 60 },
  },
  {
    name: 'الکترونیک',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-تخصصی / اتوماسیون و PLC',
    description: 'تعمیر بردها، سنسورها، درایوها و سیستم‌های کنترل دقیق',
    riasecIdeal: { R: 82, I: 90, A: 28, S: 30, E: 32, C: 64 },
  },
  {
    name: 'هیدرولیک',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-میدانی / سیستم‌های هیدرولیک',
    description: 'تعمیر و تنظیم جک‌ها، پمپ‌ها و مدارهای فشارقوی نورد',
    riasecIdeal: { R: 94, I: 75, A: 18, S: 30, E: 30, C: 54 },
  },
  {
    name: 'تعمیرات',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-میدانی / مکانیک و تعمیرات اضطراری',
    description: 'رفع خرابی‌های مکانیکی خطوط در حداقل زمان توقف تولید',
    riasecIdeal: { R: 95, I: 68, A: 20, S: 35, E: 35, C: 48 },
  },
  {
    name: 'نگهداری و تعمیرات',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-میدانی / نت پیشگیرانه (PM)',
    description: 'اجرای برنامه‌های نت پیشگیرانه، بازرسی دوره‌ای و ثبت سوابق تجهیز',
    riasecIdeal: { R: 90, I: 72, A: 20, S: 35, E: 35, C: 65 },
  },
  {
    name: 'ماشین سازی',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-کارگاهی / تراشکاری و ساخت قطعات',
    description: 'ساخت و بازسازی قطعات دقیق مکانیکی با ماشین‌ابزار',
    riasecIdeal: { R: 94, I: 72, A: 35, S: 28, E: 28, C: 58 },
  },
  {
    name: 'CNC سنگ',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-کارگاهی دقیق / ماشین‌کاری CNC',
    description: 'سنگ‌زنی غلتک‌های نورد با تلرانس میکرونی و برنامه‌نویسی CNC',
    riasecIdeal: { R: 88, I: 82, A: 30, S: 25, E: 28, C: 72 },
  },
  {
    name: 'جوشکاری',
    categoryId: 'technical',
    workSetting: 'technical',
    workSettingLabel: 'فنی-میدانی / جوشکاری صنعتی',
    description: 'ساخت و تعمیر سازه‌های فلزی و قطعات تحت فشار در کارگاه و خط',
    riasecIdeal: { R: 96, I: 48, A: 25, S: 30, E: 28, C: 45 },
  },

  // Quality, Lab & R&D
  {
    name: 'کنترل کیفیت',
    categoryId: 'quality',
    workSetting: 'lab',
    workSettingLabel: 'تحلیلی-میدانی / پایش کیفیت محصول',
    description: 'نمونه‌برداری، اندازه‌گیری ابعاد و انطباق محصول با استانداردها',
    riasecIdeal: { R: 55, I: 85, A: 24, S: 36, E: 32, C: 86 },
  },
  {
    name: 'تضمین کیفیت',
    categoryId: 'quality',
    workSetting: 'lab',
    workSettingLabel: 'پشت‌میزی تحلیلی / سیستم‌های کیفیت ISO',
    description: 'ممیزی فرآیندها، مستندسازی ایزو و تحلیل علل عدم انطباق',
    riasecIdeal: { R: 32, I: 84, A: 28, S: 48, E: 48, C: 90 },
  },
  {
    name: 'آزمایشگاه',
    categoryId: 'quality',
    workSetting: 'lab',
    workSettingLabel: 'آزمایشگاهی / تست‌های شیمیایی و خواص مکانیکی',
    description: 'تیتراسیون وان‌های اسید، کشش، سختی‌سنجی و تست پوشش روی',
    riasecIdeal: { R: 54, I: 95, A: 25, S: 30, E: 25, C: 84 },
  },
  {
    name: 'کالیبراسیون',
    categoryId: 'quality',
    workSetting: 'lab',
    workSettingLabel: 'آزمایشگاهی-فنی / ابزار دقیق و کالیبراسیون',
    description: 'تنظیم و صحه‌گذاری دقیق تجهیزات اندازه‌گیری و سنسورها',
    riasecIdeal: { R: 68, I: 92, A: 22, S: 28, E: 25, C: 86 },
  },
  {
    name: 'بازرسی',
    categoryId: 'quality',
    workSetting: 'lab',
    workSettingLabel: 'میدانی-نظارتی / بازرسی فنی و کیفیت',
    description: 'بازرسی عینی و غیرمخرب، ممیزی استانداردها و صدور تاییدیه',
    riasecIdeal: { R: 62, I: 80, A: 22, S: 42, E: 45, C: 84 },
  },
  {
    name: 'تحقیق و توسعه',
    categoryId: 'quality',
    workSetting: 'lab',
    workSettingLabel: 'پشت‌میزی-آزمایشگاهی / R&D و نوآوری',
    description: 'طراحی آزمایش، بهبود آلیاژ و فرآیند، و پژوهش مهندسی',
    riasecIdeal: { R: 50, I: 96, A: 62, S: 38, E: 44, C: 65 },
  },

  // Logistics, Warehousing & Fleet
  {
    name: 'انبار مواد اولیه و محصول',
    categoryId: 'logistics',
    workSetting: 'field',
    workSettingLabel: 'میدانی-ثبتی / مدیریت چیدمان و تحویل',
    description: 'تحویل‌گیری کویل مادر، جانمایی جرثقیل و ثبت دقیق ورود و خروج',
    riasecIdeal: { R: 76, I: 30, A: 15, S: 40, E: 42, C: 84 },
  },
  {
    name: 'انبار قطعات',
    categoryId: 'logistics',
    workSetting: 'field',
    workSettingLabel: 'ترکیبی (انبار + ثبت کد کالا)',
    description: 'کدگذاری، نگهداری قطعات یدکی حساس و تحویل به واحدهای فنی',
    riasecIdeal: { R: 65, I: 42, A: 15, S: 42, E: 35, C: 88 },
  },
  {
    name: 'لیفتراک',
    categoryId: 'logistics',
    workSetting: 'field',
    workSettingLabel: 'میدانی / حمل‌ونقل و جابه‌جایی ایمن',
    description: 'اپراتوری لیفتراک در سالن‌ها و بارگیری با سرعت واکنش و ایمنی بالا',
    riasecIdeal: { R: 94, I: 25, A: 15, S: 36, E: 32, C: 52 },
  },

  // Office, Finance, IT & Planning (Desk)
  {
    name: 'اداری',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی / امور اداری و منابع انسانی',
    description: 'مکاتبات اداری، بایگانی پرسنلی، امور کارکنان و هماهنگی ستادی',
    riasecIdeal: { R: 20, I: 48, A: 28, S: 64, E: 52, C: 94 },
  },
  {
    name: 'مالی و صندوق',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی / حسابداری و امور مالی',
    description: 'حسابداری صنعتی، خزانه‌داری، ثبت اسناد مالی و مغایرت‌گیری دقیق',
    riasecIdeal: { R: 18, I: 62, A: 18, S: 35, E: 48, C: 98 },
  },
  {
    name: 'آمار و برنامه ریزی',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی تحلیلی / برنامه‌ریزی تولید',
    description: 'تحلیل داده‌های تولید، زمان‌بندی سفارش‌ها و گزارش‌گیری مدیریتی',
    riasecIdeal: { R: 25, I: 84, A: 24, S: 38, E: 52, C: 94 },
  },
  {
    name: 'انفورماتیک',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی-فنی / فناوری اطلاعات و شبکه',
    description: 'پشتیبانی نرم‌افزار، شبکه، سخت‌افزار و امنیت سامانه‌های شرکت',
    riasecIdeal: { R: 58, I: 90, A: 35, S: 44, E: 38, C: 82 },
  },
  {
    name: 'دفتر مدیریت',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی / هماهنگی اجرایی',
    description: 'برنامه‌ریزی جلسات، پیگیری مصوبات مدیریت و ارتباطات سازمانی',
    riasecIdeal: { R: 18, I: 48, A: 32, S: 68, E: 68, C: 90 },
  },
  {
    name: 'آموزش',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی-ارتباطی / توسعه منابع انسانی',
    description: 'طراحی و اجرای دوره‌های آموزشی، نیازسنجی شغلی و توانمندسازی پرسنل',
    riasecIdeal: { R: 22, I: 66, A: 54, S: 94, E: 62, C: 72 },
  },

  {
    name: 'منابع انسانی',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی-ارتباطی / جذب، ارزیابی و امور کارکنان',
    description: 'استخدام، نگهداشت سرمایه انسانی، ارزشیابی عملکرد و امور رفاهی کارکنان',
    riasecIdeal: { R: 20, I: 54, A: 30, S: 88, E: 58, C: 86 },
  },
  {
    name: 'فناوری اطلاعات و نرم‌افزار',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی-تحلیلی / IT، سیستم‌ها و توسعه نرم‌افزار',
    description: 'توسعه و پشتیبانی سامانه‌ها، پایگاه داده، زیرساخت شبکه و امنیت اطلاعات',
    riasecIdeal: { R: 45, I: 94, A: 42, S: 40, E: 42, C: 84 },
  },
  {
    name: 'مدیریت پروژه و برنامه‌ریزی',
    categoryId: 'office',
    workSetting: 'desk',
    workSettingLabel: 'پشت‌میزی تحلیلی / PMO و کنترل پروژه',
    description: 'زمان‌بندی، بودجه‌بندی، هماهنگی تیم‌های اجرایی و پایش شاخص‌های پیشرفت',
    riasecIdeal: { R: 28, I: 76, A: 28, S: 58, E: 74, C: 90 },
  },

  // Management, Sales & Commercial
  {
    name: 'مدیریت عملیات / کارخانه',
    categoryId: 'commercial',
    workSetting: 'leadership',
    workSettingLabel: 'مدیریتی (دفتر + بازدید میدانی واحدها)',
    description: 'رهبری عملیات سازمان و پشتیبانی، تصمیم‌گیری کلان و هماهنگی واحدها',
    riasecIdeal: { R: 52, I: 62, A: 28, S: 68, E: 95, C: 72 },
  },
  {
    name: 'مدیر فنی',
    categoryId: 'commercial',
    workSetting: 'leadership',
    workSettingLabel: 'مدیریتی-فنی (پشت‌میزی + میدانی)',
    description: 'راهبری کلان مهندسی، نت و پروژه‌های تجهیزاتی سازمان',
    riasecIdeal: { R: 68, I: 84, A: 30, S: 58, E: 88, C: 68 },
  },
  {
    name: 'مدیران اجرایی و مشاوره ای',
    categoryId: 'commercial',
    workSetting: 'leadership',
    workSettingLabel: 'مدیریتی / راهبردی و مشاوره',
    description: 'سیاست‌گذاری، مشاوره اجرایی و نظارت بر عملکرد کلان واحدها',
    riasecIdeal: { R: 28, I: 70, A: 36, S: 72, E: 95, C: 76 },
  },
  {
    name: 'مدیرعامل و هیئت‌مدیره',
    categoryId: 'commercial',
    workSetting: 'leadership',
    workSettingLabel: 'مدیریت عالی / رهبری راهبردی',
    description: 'هدایت راهبردی سازمان، مذاکرات کلان و تصمیم‌گیری سطح بالا',
    riasecIdeal: { R: 25, I: 65, A: 35, S: 70, E: 98, C: 72 },
  },
  {
    name: 'فروش',
    categoryId: 'commercial',
    workSetting: 'leadership',
    workSettingLabel: 'پشت‌میزی و ارتباطی / فروش و مشتری‌مداری',
    description: 'ارتباط با مشتریان، مذاکره فروش، پیگیری سفارش و توسعه بازار',
    riasecIdeal: { R: 20, I: 40, A: 36, S: 80, E: 96, C: 66 },
  },
  {
    name: 'بازرگانی',
    categoryId: 'commercial',
    workSetting: 'leadership',
    workSettingLabel: 'پشت‌میزی-مذاکره‌ای / تأمین و خرید',
    description: 'مذاکره با تأمین‌کنندگان، قراردادهای خرید، ترخیص و لجستیک تجاری',
    riasecIdeal: { R: 24, I: 48, A: 26, S: 62, E: 92, C: 82 },
  },

  // HSE, Security & Support
  {
    name: 'ایمنی و بهداشت',
    categoryId: 'safety_support',
    workSetting: 'support',
    workSettingLabel: 'میدانی-نظارتی / ایمنی و بهداشت کار (HSE)',
    description: 'ارزیابی ریسک سالن‌ها، آموزش ایمنی پرسنل، ممیزی PPE و پیشگیری از حوادث',
    riasecIdeal: { R: 58, I: 68, A: 24, S: 88, E: 56, C: 74 },
  },
  {
    name: 'انتظامات',
    categoryId: 'safety_support',
    workSetting: 'support',
    workSettingLabel: 'میدانی-حفاظتی / نگهبانی و کنترل تردد',
    description: 'حراست فیزیکی، کنترل ورود و خروج کالا و افراد، و گزارش‌دهی دقیق',
    riasecIdeal: { R: 68, I: 28, A: 14, S: 64, E: 48, C: 74 },
  },
  {
    name: 'خدمات',
    categoryId: 'safety_support',
    workSetting: 'support',
    workSettingLabel: 'میدانی / پشتیبانی و خدمات عمومی',
    description: 'پشتیبانی محیطی، نظافت و خدمات عمومی سازمان',
    riasecIdeal: { R: 74, I: 20, A: 18, S: 72, E: 25, C: 58 },
  },
  {
    name: 'پشتیبانی و خدمات مشتریان',
    categoryId: 'safety_support',
    workSetting: 'support',
    workSettingLabel: 'ارتباطی-پشتیبانی / پاسخگویی و امور مراجعین',
    description: 'پاسخگویی به مشتریان و مراجعین، پیگیری درخواست‌ها و رفع مشکلات',
    riasecIdeal: { R: 25, I: 45, A: 26, S: 92, E: 64, C: 74 },
  },
  {
    name: 'آشپزخانه',
    categoryId: 'safety_support',
    workSetting: 'support',
    workSettingLabel: 'میدانی-خدماتی / طبخ و تغذیه پرسنلی',
    description: 'آماده‌سازی وعده‌های غذایی پرسنل، رعایت بهداشت و مدیریت مصرف',
    riasecIdeal: { R: 70, I: 24, A: 42, S: 76, E: 32, C: 62 },
  },
];

const SETTING_RIASEC_DEFAULTS: Record<WorkSettingType, RiasecProfile> = {
  field: { R: 90, I: 36, A: 20, S: 40, E: 34, C: 60 },
  technical: { R: 88, I: 80, A: 28, S: 34, E: 36, C: 58 },
  desk: { R: 22, I: 66, A: 28, S: 52, E: 50, C: 94 },
  lab: { R: 54, I: 92, A: 30, S: 34, E: 30, C: 84 },
  leadership: { R: 28, I: 58, A: 34, S: 74, E: 95, C: 70 },
  support: { R: 56, I: 40, A: 24, S: 86, E: 48, C: 68 },
};

export function getCustomWorkUnits(): WorkUnitDef[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((u) => u && typeof u.name === 'string' && u.name.trim());
  } catch {
    return [];
  }
}

export function addCustomWorkUnit(input: {
  name: string;
  categoryId: OccupationalCategoryId;
  workSetting: WorkSettingType;
  description?: string;
}): WorkUnitDef[] {
  const cleanName = input.name.trim();
  const current = getCustomWorkUnits().filter(
    (u) => normalizeFa(u.name) !== normalizeFa(cleanName)
  );
  const newUnit: WorkUnitDef = {
    name: cleanName,
    categoryId: input.categoryId,
    workSetting: input.workSetting,
    workSettingLabel: WORK_SETTING_LABEL[input.workSetting],
    description: input.description?.trim() || `واحد کاری سفارشی (${WORK_SETTING_LABEL[input.workSetting]})`,
    riasecIdeal: SETTING_RIASEC_DEFAULTS[input.workSetting],
    isCustom: true,
  };
  const next = [...current, newUnit];
  localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeCustomWorkUnit(unitName: string): WorkUnitDef[] {
  const next = getCustomWorkUnits().filter(
    (u) => normalizeFa(u.name) !== normalizeFa(unitName)
  );
  localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getAllWorkUnits(): WorkUnitDef[] {
  const custom = getCustomWorkUnits();
  if (custom.length === 0) return DEFAULT_WORK_UNITS;
  const existingNames = new Set(DEFAULT_WORK_UNITS.map((u) => normalizeFa(u.name)));
  return [
    ...DEFAULT_WORK_UNITS,
    ...custom.filter((u) => !existingNames.has(normalizeFa(u.name))),
  ];
}

export function findWorkUnit(deptName: string): WorkUnitDef | undefined {
  const norm = normalizeFa(deptName);
  if (!norm) return undefined;
  const units = getAllWorkUnits();
  return (
    units.find((u) => normalizeFa(u.name) === norm) ||
    units.find((u) => norm.includes(normalizeFa(u.name)) || normalizeFa(u.name).includes(norm))
  );
}

export function getCategoryById(id: OccupationalCategoryId): OccupationalCategoryDef {
  return OCCUPATIONAL_CATEGORIES.find((c) => c.id === id) || OCCUPATIONAL_CATEGORIES[0];
}

export function getCategoryForDept(deptName: string): OccupationalCategoryDef | undefined {
  const unit = findWorkUnit(deptName);
  if (unit) return getCategoryById(unit.categoryId);
  return undefined;
}

export interface SettingAffinity {
  id: 'desk' | 'field' | 'technical' | 'lab' | 'leadership';
  title: string;
  subtitle: string;
  score: number; // 0..100
}

export interface UnitRecommendation {
  unit: WorkUnitDef;
  category: OccupationalCategoryDef;
  fitPct: number;
  reason: string;
}

export interface PlacementAnalysis {
  hollandCode: string;
  hollandLabel: string;
  riasecPct: RiasecProfile;
  settingsRanked: SettingAffinity[];
  primarySetting: SettingAffinity;
  topUnits: UnitRecommendation[];
  allUnitsRanked: UnitRecommendation[];
  currentUnitMatch?: UnitRecommendation;
  verdictSummary: string;
  usedBigFive: boolean;
}

const RIASEC_NAMES_FA: Record<keyof RiasecProfile, string> = {
  R: 'واقع‌گرا (عملی و فنی)',
  I: 'جستجوگر (تحلیلی و علمی)',
  A: 'هنری (خلاق و طراحی)',
  S: 'اجتماعی (حمایتی، آموزشی و ایمنی)',
  E: 'متهور (مدیریتی، فروش و رهبری)',
  C: 'قراردادی (اداری، منظم و پشت‌میزی)',
};

function extractDimPct(result: TestResult, keyword: string): number | null {
  const found = result.dims.find((d) => normalizeFa(d.name).includes(normalizeFa(keyword)));
  return found ? Math.round(found.pct * 100) : null;
}

function similarityScore(userVec: number[], idealVec: number[]): number {
  // Combination of weighted Euclidean closeness and profile shape (cosine)
  let sqSum = 0;
  let dot = 0;
  let normU = 0;
  let normI = 0;
  for (let i = 0; i < userVec.length; i++) {
    const u = userVec[i];
    const id = idealVec[i];
    const diff = u - id;
    sqSum += diff * diff;
    dot += u * id;
    normU += u * u;
    normI += id * id;
  }
  const rmse = Math.sqrt(sqSum / userVec.length);
  const closeness = Math.max(0, 100 - rmse * 1.15);
  const cosine = normU > 0 && normI > 0 ? (dot / (Math.sqrt(normU) * Math.sqrt(normI))) * 100 : 50;
  return Math.round(Math.min(99, Math.max(20, closeness * 0.45 + cosine * 0.55)));
}

export function computePlacementAnalysis(
  riasecResult: TestResult | undefined,
  ipipResult: TestResult | undefined,
  currentDept?: string
): PlacementAnalysis | null {
  if (!riasecResult) return null;

  const R = extractDimPct(riasecResult, 'واقع‌گرا') ?? 50;
  const I = extractDimPct(riasecResult, 'جستجوگر') ?? 50;
  const A = extractDimPct(riasecResult, 'هنری') ?? 50;
  const S = extractDimPct(riasecResult, 'اجتماعی') ?? 50;
  const E = extractDimPct(riasecResult, 'متهور') ?? 50;
  const C = extractDimPct(riasecResult, 'قراردادی') ?? 50;

  const riasecPct: RiasecProfile = { R, I, A, S, E, C };

  // Extract Big Five if available to refine work-setting fit (Barrick & Mount, 1991)
  let usedBigFive = false;
  let bfC = 55;
  let bfE = 55;
  let bfO = 55;
  let bfA = 55;
  let bfStab = 55;
  if (ipipResult) {
    usedBigFive = true;
    bfE = extractDimPct(ipipResult, 'برون‌گرایی') ?? 55;
    bfA = extractDimPct(ipipResult, 'توافق‌پذیری') ?? 55;
    bfC = extractDimPct(ipipResult, 'وظیفه‌شناسی') ?? 55;
    const bfN = extractDimPct(ipipResult, 'ناپایداری') ?? 45;
    bfStab = 100 - bfN;
    bfO = extractDimPct(ipipResult, 'گشودگی') ?? 55;
  }

  // Holland 3-letter code
  const entries = (Object.entries(riasecPct) as Array<[keyof RiasecProfile, number]>).sort(
    (a, b) => b[1] - a[1]
  );
  const hollandCode = entries
    .slice(0, 3)
    .map((x) => x[0])
    .join('-');
  const hollandLabel = entries
    .slice(0, 2)
    .map((x) => RIASEC_NAMES_FA[x[0]])
    .join(' + ');

  // Work Setting Affinities (Desk vs. Field vs. Technical vs. Lab vs. Leadership)
  const rawSettings: SettingAffinity[] = [
    {
      id: 'desk',
      title: 'کار پشت‌میزی، اداری، مالی و برنامه‌ریزی',
      subtitle: 'مناسب امور دفتری، حسابداری، آمار و برنامه‌ریزی، انفورماتیک و اسناد',
      score: Math.round(
        Math.min(
          99,
          C * 0.55 + I * 0.2 + E * 0.15 + (100 - R) * 0.1 + (usedBigFive ? (bfC - 50) * 0.15 : 0)
        )
      ),
    },
    {
      id: 'field',
      title: 'کار میدانی، خطوط تولید و عملیات انبار',
      subtitle: 'مناسب سالن‌های تولید (نورد، گالوانیزه، برش، بسته‌بندی)، انبار و لیفتراک',
      score: Math.round(
        Math.min(
          99,
          R * 0.65 + C * 0.2 + S * 0.15 + (usedBigFive ? (bfStab - 50) * 0.12 + (bfC - 50) * 0.1 : 0)
        )
      ),
    },
    {
      id: 'technical',
      title: 'کار فنی-کارگاهی، مهندسی و نگهداری و تعمیرات',
      subtitle: 'مناسب برق، الکترونیک، هیدرولیک، تاسیسات، ماشین‌سازی، CNC و فنی و مهندسی',
      score: Math.round(
        Math.min(
          99,
          R * 0.5 + I * 0.35 + C * 0.15 + (usedBigFive ? (bfO - 50) * 0.1 + (bfC - 50) * 0.1 : 0)
        )
      ),
    },
    {
      id: 'lab',
      title: 'کار آزمایشگاهی، کنترل کیفیت و تحقیق',
      subtitle: 'مناسب آزمایشگاه، کنترل/تضمین کیفیت، کالیبراسیون، بازرسی و R&D',
      score: Math.round(
        Math.min(
          99,
          I * 0.52 + C * 0.33 + R * 0.15 + (usedBigFive ? (bfC - 50) * 0.15 : 0)
        )
      ),
    },
    {
      id: 'leadership',
      title: 'کار مدیریتی، سرپرستی، فروش و بازرگانی',
      subtitle: 'مناسب فروش، بازرگانی، سرپرستی خطوط و مدیریت اجرایی',
      score: Math.round(
        Math.min(
          99,
          E * 0.55 + S * 0.25 + C * 0.2 + (usedBigFive ? (bfE - 50) * 0.15 + (bfStab - 50) * 0.1 : 0)
        )
      ),
    },
  ];
  const settingsRanked = rawSettings.sort((a, b) => b.score - a.score);

  const primarySetting = settingsRanked[0];

  // Rank all standard + custom organizational work units
  const userVec = [R, I, A, S, E, C];
  const allUnitsRanked: UnitRecommendation[] = getAllWorkUnits().map((unit) => {
    const ideal = unit.riasecIdeal;
    const idealVec = [ideal.R, ideal.I, ideal.A, ideal.S, ideal.E, ideal.C];
    const cat = getCategoryById(unit.categoryId);

    let fitPct = similarityScore(userVec, idealVec);

    if (usedBigFive) {
      let bfBonus = 0;
      if (cat.bigFiveIdeal.C && bfC >= 65) bfBonus += 3;
      if (cat.bigFiveIdeal.C && bfC < 40) bfBonus -= 5;
      if (unit.categoryId === 'commercial' && bfE >= 65) bfBonus += 4;
      if (unit.categoryId === 'office' && bfC >= 70) bfBonus += 3;
      if ((unit.categoryId === 'production' || unit.categoryId === 'technical') && bfStab >= 65) {
        bfBonus += 3;
      }
      if (unit.categoryId === 'safety_support' && bfA >= 65 && bfC >= 65) bfBonus += 3;
      fitPct = Math.round(Math.min(99, Math.max(20, fitPct + bfBonus)));
    }

    const topTraits = (['R', 'I', 'A', 'S', 'E', 'C'] as Array<keyof RiasecProfile>)
      .filter((k) => ideal[k] >= 70 && riasecPct[k] >= 60)
      .map((k) => RIASEC_NAMES_FA[k].split(' ')[0]);

    const reason =
      topTraits.length > 0
        ? `هم‌راستایی بالای تیپ ${topTraits.join(' و ')} با الزامات محیط «${unit.workSettingLabel}»`
        : `تناسب کلی پروفایل هالند با ساختار وظایف واحد ${unit.name}`;

    return {
      unit,
      category: cat,
      fitPct,
      reason,
    };
  }).sort((a, b) => b.fitPct - a.fitPct);

  const topUnits = allUnitsRanked.slice(0, 5);

  const matchedCurrent = currentDept
    ? allUnitsRanked.find((u) => normalizeFa(u.unit.name) === normalizeFa(currentDept)) ||
      allUnitsRanked.find(
        (u) =>
          normalizeFa(currentDept).includes(normalizeFa(u.unit.name)) ||
          normalizeFa(u.unit.name).includes(normalizeFa(currentDept))
      )
    : undefined;

  const deskScore = settingsRanked.find((s) => s.id === 'desk')?.score || 0;
  const fieldScore = settingsRanked.find((s) => s.id === 'field')?.score || 0;
  const techScore = settingsRanked.find((s) => s.id === 'technical')?.score || 0;

  let deskFieldText = '';
  if (primarySetting.id === 'desk') {
    deskFieldText = `گرایش شخصیت شغلی این فرد به‌طور مشخص مناسب «کار پشت‌میزی و ستادی» است (تناسب پشت‌میزی ${deskScore}٪ در برابر میدانی ${fieldScore}٪).`;
  } else if (primarySetting.id === 'field') {
    deskFieldText = `پروفایل این فرد بیشترین تناسب را با «کار میدانی، عملیاتی و خط تولید» دارد (تناسب میدانی ${fieldScore}٪ در برابر پشت‌میزی ${deskScore}٪).`;
  } else if (primarySetting.id === 'technical') {
    deskFieldText = `این فرد مناسب «کار فنی-تخصصی و کارگاهی/میدانی» است (تناسب فنی ${techScore}٪) و در محیط‌های تعمیراتی و مهندسی بهترین بازده را دارد.`;
  } else if (primarySetting.id === 'lab') {
    deskFieldText = `پروفایل تحلیلی-ساختاریافته فرد نشان‌دهنده‌ی تناسب بالا با «کار آزمایشگاهی، کنترل کیفیت و کالیبراسیون» است.`;
  } else {
    deskFieldText = `تیپ متهور و ارتباطی فرد نشان‌دهنده‌ی تناسب بالا با «کار مدیریتی، سرپرستی، فروش و بازرگانی» است.`;
  }

  const verdictSummary = `${deskFieldText} بر اساس کد هالند (${hollandCode})، بهترین واحدهای کاری پیشنهادی در سازمان عبارت‌اند از: ${topUnits
    .slice(0, 3)
    .map((u) => `${u.unit.name} (${u.fitPct}٪)`)
    .join('، ')}.`;

  return {
    hollandCode,
    hollandLabel,
    riasecPct,
    settingsRanked,
    primarySetting,
    topUnits,
    allUnitsRanked,
    currentUnitMatch: matchedCurrent,
    verdictSummary,
    usedBigFive,
  };
}
