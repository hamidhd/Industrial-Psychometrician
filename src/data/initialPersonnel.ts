export interface MasterPerson {
  personnelId: string;
  name: string;
  nationalCode: string;
  mobile: string;
  dept: string;
  hireDate: string;
  role: 'admin' | 'evaluator' | 'employee';
  username?: string;
  password?: string;
  mustChangePassword?: boolean;
  hasResultAccess: boolean;
}

export const SAMPLE_MASTER_EMPLOYEES: MasterPerson[] = [
  {
    personnelId: '10001',
    name: 'کاربر نمونه پرسنلی',
    nationalCode: '0000000001',
    mobile: '09120000001',
    dept: 'اداری',
    hireDate: '1403/01/01',
    role: 'employee',
    hasResultAccess: false,
  },
  {
    personnelId: '10002',
    name: 'اپراتور نمونه میدانی',
    nationalCode: '0000000002',
    mobile: '09120000002',
    dept: 'بهره برداری',
    hireDate: '1403/01/01',
    role: 'employee',
    hasResultAccess: false,
  },
];

export const INITIAL_MASTER_PERSONNEL: MasterPerson[] = [
  {
    personnelId: '1001',
    name: 'مدیر ارشد سیستم (HSE / منابع انسانی)',
    nationalCode: '0011223344',
    mobile: '09120000000',
    dept: 'ایمنی و بهداشت',
    hireDate: '1400/01/01',
    role: 'admin',
    username: 'admin',
    password: 'admin123',
    mustChangePassword: true,
    hasResultAccess: true,
  },
  {
    personnelId: '1002',
    name: 'ارزیاب / پزشک طب کار / روان‌شناس',
    nationalCode: '0055667788',
    mobile: '09121111111',
    dept: 'ایمنی و بهداشت',
    hireDate: '1400/01/01',
    role: 'evaluator',
    username: 'evaluator',
    password: 'eval123',
    mustChangePassword: true,
    hasResultAccess: true,
  },
  ...SAMPLE_MASTER_EMPLOYEES,
];
