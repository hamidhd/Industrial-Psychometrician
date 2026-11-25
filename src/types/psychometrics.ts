export type Tone = 'good' | 'mid' | 'warn' | 'bad' | 'info';

export type TestId =
  | 'riasec'
  | 'ipip'
  | 'dass'
  | 'safety'
  | 'integrity'
  | 'burnout'
  | 'fatigue'
  | 'reaction'
  | 'stroop'
  | 'digits'
  | 'trail';

export type PersonKind = 'candidate' | 'employee';

export type WorkSettingType =
  | 'field'
  | 'technical'
  | 'desk'
  | 'lab'
  | 'leadership'
  | 'support';

export type OccupationalCategoryId =
  | 'production'
  | 'technical'
  | 'quality'
  | 'logistics'
  | 'office'
  | 'commercial'
  | 'safety_support';

export interface BandDef {
  upTo: number;
  label: string;
  tone: Tone;
  text: string;
}

export interface DimensionDef {
  name: string;
  bands: BandDef[];
}

export interface TestGuide {
  measures: string;
  admin: string[];
  use: string[];
  limits: string[];
}

export interface DimensionResult {
  name: string;
  display: string;
  pct: number;
  label: string;
  tone: Tone;
  text: string;
}

export interface ResultFlag {
  tone: 'warn' | 'bad';
  text: string;
}

export type QuestionnaireItem = [text: string, dimKey: string, reverse?: 1];

export interface QuestionnaireDef {
  id: TestId;
  type: 'q';
  title: string;
  short: string;
  minutes: number;
  mult?: number;
  scale: {
    min: number;
    max: number;
    labels: string[];
  };
  intro: string;
  items: QuestionnaireItem[];
  dims: Record<string, DimensionDef>;
  flags?: (answers: number[], scMap: Record<string, { value: number }>) => ResultFlag[];
  guide: TestGuide;
}

export interface TaskDef {
  id: 'reaction' | 'stroop' | 'digits' | 'trail';
  type: 't';
  title: string;
  short: string;
  minutes: number;
  intro: string;
  interpret: (raw: Record<string, unknown>) => {
    dims: DimensionResult[];
    flags: ResultFlag[];
  };
  guide: TestGuide;
}

export type AnyTestDef = QuestionnaireDef | TaskDef;

export interface BatteryDef {
  id: string;
  name: string;
  categoryId?: OccupationalCategoryId;
  tests: TestId[];
  note: string;
}

export interface Workspace {
  id: string;
  org: string;
  examiner: string;
  ownerId: string;
  ownerEmail: string;
  allowedEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Person {
  id: string;
  workspaceId: string;
  ownerId: string;
  allowedEmails: string[];
  name: string;
  code: string;
  kind: PersonKind;
  dept: string;
  job: string;
  age: string;
  consent: boolean;
  created: number;
  createdByUid: string;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TestResult {
  id: string;
  workspaceId: string;
  personId: string;
  ownerId: string;
  allowedEmails: string[];
  testId: TestId;
  date: number;
  computerLabel: string;
  recordedByUid: string;
  recordedByEmail: string;
  examiner: string;
  answers?: number[];
  taskMetrics?: Record<string, unknown>;
  dims: DimensionResult[];
  flags: ResultFlag[];
  createdAt?: unknown;
}

export interface LegacyBackupPerson {
  id?: string;
  name: string;
  code?: string;
  kind?: string;
  dept?: string;
  job?: string;
  age?: string | number;
  created?: number;
  results?: Array<{
    id?: string;
    testId: TestId;
    date?: number;
    data?: unknown;
    answers?: number[];
    taskMetrics?: Record<string, unknown>;
    dims?: DimensionResult[];
    flags?: ResultFlag[];
  }>;
}

export interface ManagedAuthUser {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'evaluator';
  dept: string;
  createdAt: number;
}

export interface AppUser {
  id: string;
  personnelId: string;
  name: string;
  nationalCode: string;
  mobile: string;
  dept: string;
  hireDate: string;
  role: 'admin' | 'evaluator' | 'employee';
  username?: string;
  hasResultAccess: boolean;
  isEnvAdmin?: boolean;
}

export type ViewName = 'home' | 'people' | 'run' | 'results' | 'help' | 'settings';

