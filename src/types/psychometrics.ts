export type Tone = 'good' | 'mid' | 'warn' | 'bad' | 'info';

export type TestId =
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
  name: string;
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

export type ViewName = 'home' | 'people' | 'run' | 'results' | 'help' | 'settings';
