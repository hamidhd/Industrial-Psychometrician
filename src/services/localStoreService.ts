import type {
  DimensionResult,
  LegacyBackupPerson,
  Person,
  PersonKind,
  ResultFlag,
  TestId,
  TestResult,
  Workspace,
} from '../types/psychometrics';

export function makeSafeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const STORAGE_KEY = 'rsi_local_db_v2';
const CHANNEL_NAME = 'rsi_local_sync';

interface LocalDbState {
  workspaces: Workspace[];
  people: Person[];
  results: TestResult[];
}

const listeners = new Set<() => void>();
let bc: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = () => {
      listeners.forEach((fn) => fn());
    };
  } catch {
    bc = null;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      listeners.forEach((fn) => fn());
    }
  });
}

function readDb(): LocalDbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
        people: Array.isArray(parsed.people) ? parsed.people : [],
        results: Array.isArray(parsed.results) ? parsed.results : [],
      };
    }
  } catch {
    // ignore
  }
  const defaultWs: Workspace = {
    id: 'ws_local_default',
    org: 'سازمان من — واحد ارزیابی و منابع انسانی',
    examiner: 'واحد ایمنی و بهداشت (HSE) / منابع انسانی',
    ownerId: 'local_admin',
    ownerEmail: 'admin@ravansanj.local',
    allowedEmails: ['admin@ravansanj.local', 'user@ravansanj.local'],
  };
  const init: LocalDbState = { workspaces: [defaultWs], people: [], results: [] };
  writeDb(init);
  return init;
}

function writeDb(state: LocalDbState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  listeners.forEach((fn) => fn());
  if (bc) {
    try {
      bc.postMessage({ type: 'updated', ts: Date.now() });
    } catch {
      // ignore
    }
  }
}

export function subscribeLocalWorkspaces(onData: (list: Workspace[]) => void): () => void {
  const emit = () => onData(readDb().workspaces);
  emit();
  listeners.add(emit);
  return () => {
    listeners.delete(emit);
  };
}

export function subscribeLocalPeople(
  workspaceId: string,
  onData: (list: Person[]) => void
): () => void {
  const emit = () => {
    const list = readDb()
      .people.filter((p) => p.workspaceId === workspaceId)
      .sort((a, b) => b.created - a.created);
    onData(list);
  };
  emit();
  listeners.add(emit);
  return () => {
    listeners.delete(emit);
  };
}

export function subscribeLocalResults(
  workspaceId: string,
  onData: (list: TestResult[]) => void
): () => void {
  const emit = () => {
    const list = readDb()
      .results.filter((r) => r.workspaceId === workspaceId)
      .sort((a, b) => b.date - a.date);
    onData(list);
  };
  emit();
  listeners.add(emit);
  return () => {
    listeners.delete(emit);
  };
}

export function localCreateWorkspace(org: string, examiner: string, ownerName: string): string {
  const db = readDb();
  const id = makeSafeId('ws');
  const ws: Workspace = {
    id,
    org: org.trim().slice(0, 120),
    examiner: (examiner || ownerName).trim().slice(0, 120),
    ownerId: 'local_admin',
    ownerEmail: 'admin@ravansanj.local',
    allowedEmails: ['admin@ravansanj.local', 'user@ravansanj.local'],
  };
  db.workspaces.push(ws);
  writeDb(db);
  return id;
}

export function localUpdateWorkspaceMeta(workspaceId: string, org: string, examiner: string): void {
  const db = readDb();
  db.workspaces = db.workspaces.map((w) =>
    w.id === workspaceId
      ? { ...w, org: org.trim().slice(0, 120), examiner: examiner.trim().slice(0, 120) }
      : w
  );
  writeDb(db);
}

export function localCreatePerson(
  workspace: Workspace,
  userId: string,
  input: {
    name: string;
    code: string;
    kind: PersonKind;
    dept: string;
    job: string;
    age: string;
    consent: boolean;
  }
): string {
  const db = readDb();
  const id = makeSafeId('p');
  const person: Person = {
    id,
    workspaceId: workspace.id,
    ownerId: workspace.ownerId,
    allowedEmails: workspace.allowedEmails,
    name: input.name.trim().slice(0, 120),
    code: input.code.trim().slice(0, 40),
    kind: input.kind,
    dept: input.dept.trim().slice(0, 100),
    job: input.job.trim().slice(0, 100),
    age: input.age.trim().slice(0, 10),
    consent: Boolean(input.consent),
    created: Date.now(),
    createdByUid: userId,
    createdByEmail: 'local@ravansanj.local',
  };
  db.people.push(person);
  writeDb(db);
  return id;
}

export function localBatchCreatePeople(
  workspace: Workspace,
  userId: string,
  items: Array<{
    name: string;
    code: string;
    kind: PersonKind;
    dept: string;
    job: string;
    age: string;
  }>
): number {
  const db = readDb();
  const existingCodes = new Set(
    db.people.filter((p) => p.workspaceId === workspace.id && p.code).map((p) => p.code.trim())
  );
  let added = 0;
  const baseTs = Date.now();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.code && existingCodes.has(it.code.trim())) continue;
    if (it.code) existingCodes.add(it.code.trim());
    db.people.push({
      id: `${makeSafeId('p')}_${i}`,
      workspaceId: workspace.id,
      ownerId: workspace.ownerId,
      allowedEmails: workspace.allowedEmails,
      name: it.name.trim().slice(0, 120),
      code: it.code.trim().slice(0, 40),
      kind: it.kind,
      dept: it.dept.trim().slice(0, 100),
      job: it.job.trim().slice(0, 100),
      age: it.age.trim().slice(0, 10),
      consent: true,
      created: baseTs - i,
      createdByUid: userId,
      createdByEmail: 'local@ravansanj.local',
    });
    added++;
  }
  if (added > 0) writeDb(db);
  return added;
}

export function localUpdatePerson(
  workspaceId: string,
  personId: string,
  input: {
    name: string;
    code: string;
    kind: PersonKind;
    dept: string;
    job: string;
    age: string;
  }
): void {
  const db = readDb();
  db.people = db.people.map((p) =>
    p.id === personId && p.workspaceId === workspaceId
      ? {
          ...p,
          name: input.name.trim().slice(0, 120),
          code: input.code.trim().slice(0, 40),
          kind: input.kind,
          dept: input.dept.trim().slice(0, 100),
          job: input.job.trim().slice(0, 100),
          age: input.age.trim().slice(0, 10),
        }
      : p
  );
  writeDb(db);
}

export function localDeletePersonAndResults(workspaceId: string, personId: string): void {
  const db = readDb();
  db.people = db.people.filter((p) => !(p.id === personId && p.workspaceId === workspaceId));
  db.results = db.results.filter(
    (r) => !(r.personId === personId && r.workspaceId === workspaceId)
  );
  writeDb(db);
}

export function localCreateTestResult(
  workspace: Workspace,
  userId: string,
  computerLabel: string,
  payload: {
    personId: string;
    testId: TestId;
    answers?: number[];
    taskMetrics?: Record<string, unknown>;
    dims: DimensionResult[];
    flags: ResultFlag[];
  }
): string {
  const db = readDb();
  const id = makeSafeId('r');
  db.results.push({
    id,
    workspaceId: workspace.id,
    personId: payload.personId,
    ownerId: workspace.ownerId,
    allowedEmails: workspace.allowedEmails,
    testId: payload.testId,
    date: Date.now(),
    computerLabel: (computerLabel || 'ایستگاه محلی').slice(0, 80),
    recordedByUid: userId,
    recordedByEmail: 'local@ravansanj.local',
    examiner: workspace.examiner,
    answers: payload.answers,
    taskMetrics: payload.taskMetrics,
    dims: payload.dims,
    flags: payload.flags,
  });
  writeDb(db);
  return id;
}

export function localDeleteTestResult(workspaceId: string, resultId: string): void {
  const db = readDb();
  db.results = db.results.filter((r) => !(r.id === resultId && r.workspaceId === workspaceId));
  writeDb(db);
}

export function localWipeWorkspace(workspaceId: string): void {
  const db = readDb();
  db.people = db.people.filter((p) => p.workspaceId !== workspaceId);
  db.results = db.results.filter((r) => r.workspaceId !== workspaceId);
  writeDb(db);
}

export function localImportBackup(
  workspace: Workspace,
  userId: string,
  computerLabel: string,
  backup: { org?: string; examiner?: string; people: LegacyBackupPerson[] },
  mode: 'merge' | 'replace'
): { importedPeople: number; importedResults: number } {
  const db = readDb();
  if (mode === 'replace') {
    db.people = db.people.filter((p) => p.workspaceId !== workspace.id);
    db.results = db.results.filter((r) => r.workspaceId !== workspace.id);
    if (backup.org !== undefined || backup.examiner !== undefined) {
      db.workspaces = db.workspaces.map((w) =>
        w.id === workspace.id
          ? { ...w, org: backup.org ?? w.org, examiner: backup.examiner ?? w.examiner }
          : w
      );
    }
  }
  const existingIds = new Set(
    db.people.filter((p) => p.workspaceId === workspace.id).map((p) => p.id)
  );
  let importedPeople = 0;
  let importedResults = 0;

  for (const rawP of backup.people) {
    if (!rawP || !rawP.name) continue;
    const pid = rawP.id && !existingIds.has(rawP.id) ? rawP.id : makeSafeId('p');
    if (existingIds.has(pid)) continue;
    existingIds.add(pid);
    db.people.push({
      id: pid,
      workspaceId: workspace.id,
      ownerId: workspace.ownerId,
      allowedEmails: workspace.allowedEmails,
      name: String(rawP.name).slice(0, 120),
      code: String(rawP.code || '').slice(0, 40),
      kind: rawP.kind === 'employee' ? 'employee' : 'candidate',
      dept: String(rawP.dept || '').slice(0, 100),
      job: String(rawP.job || '').slice(0, 100),
      age: String(rawP.age || '').slice(0, 10),
      consent: true,
      created: Number(rawP.created || Date.now()),
      createdByUid: userId,
      createdByEmail: 'local@ravansanj.local',
    });
    importedPeople++;

    for (const rawR of rawP.results || []) {
      if (!rawR || !rawR.testId || !Array.isArray(rawR.dims) || rawR.dims.length === 0) continue;
      db.results.push({
        id: rawR.id || makeSafeId('r'),
        workspaceId: workspace.id,
        personId: pid,
        ownerId: workspace.ownerId,
        allowedEmails: workspace.allowedEmails,
        testId: rawR.testId,
        date: Number(rawR.date || Date.now()),
        computerLabel: computerLabel || 'بازیابی پشتیبان',
        recordedByUid: userId,
        recordedByEmail: 'local@ravansanj.local',
        examiner: workspace.examiner,
        answers: Array.isArray(rawR.answers)
          ? rawR.answers.map(Number)
          : Array.isArray(rawR.data)
            ? rawR.data.map(Number)
            : undefined,
        taskMetrics:
          rawR.taskMetrics && typeof rawR.taskMetrics === 'object' && !Array.isArray(rawR.taskMetrics)
            ? (rawR.taskMetrics as Record<string, unknown>)
            : !Array.isArray(rawR.data) && rawR.data && typeof rawR.data === 'object'
              ? (rawR.data as Record<string, unknown>)
              : undefined,
        dims: rawR.dims,
        flags: Array.isArray(rawR.flags) ? rawR.flags : [],
      });
      importedResults++;
    }
  }

  writeDb(db);
  return { importedPeople, importedResults };
}
