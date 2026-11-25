export interface MasterPerson {
  personnelId: string;
  name: string;
  nationalCode: string;
  mobile: string;
  dept: string;
  hireDate: string;
  role: 'employee';
  hasResultAccess: false;
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
