import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  DimensionResult,
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

const normStr = (val: unknown, max: number) => String(val ?? '').trim().slice(0, max);

function sanitizeAllowedEmails(emails: string[], ownerEmail: string): string[] {
  const owner = ownerEmail.trim().toLowerCase();
  const set = new Set<string>([owner]);
  for (const raw of emails) {
    const clean = raw.trim().toLowerCase();
    if (clean && clean.includes('@') && clean.length >= 3 && clean.length <= 200) {
      set.add(clean);
    }
    if (set.size >= 20) break;
  }
  return Array.from(set);
}

export function subscribeWorkspaces(
  userEmail: string,
  onData: (workspaces: Workspace[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = 'workspaces';
  const email = userEmail.trim().toLowerCase();
  const q = query(collection(db, path), where('allowedEmails', 'array-contains', email));
  return onSnapshot(
    q,
    (snap) => {
      const list: Workspace[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          org: String(data.org ?? ''),
          examiner: String(data.examiner ?? ''),
          ownerId: String(data.ownerId ?? ''),
          ownerEmail: String(data.ownerEmail ?? ''),
          allowedEmails: Array.isArray(data.allowedEmails) ? data.allowedEmails.map(String) : [],
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createWorkspace(
  user: User,
  org: string,
  examiner: string
): Promise<string> {
  const id = makeSafeId('ws');
  const path = `workspaces/${id}`;
  const email = (user.email || '').trim().toLowerCase();
  try {
    await setDoc(doc(db, 'workspaces', id), {
      org: normStr(org, 120),
      examiner: normStr(examiner, 120),
      ownerId: user.uid,
      ownerEmail: email,
      allowedEmails: [email],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWorkspaceMeta(
  workspaceId: string,
  org: string,
  examiner: string
): Promise<void> {
  const path = `workspaces/${workspaceId}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId), {
      org: normStr(org, 120),
      examiner: normStr(examiner, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWorkspaceAllowedEmails(
  workspace: Workspace,
  nextEmails: string[],
  peopleIds: string[],
  resultIds: string[]
): Promise<void> {
  const sanitized = sanitizeAllowedEmails(nextEmails, workspace.ownerEmail);
  const wsPath = `workspaces/${workspace.id}`;
  try {
    // 1. Update workspace first so subcollection security rules reading parent workspace see the new list
    await updateDoc(doc(db, 'workspaces', workspace.id), {
      allowedEmails: sanitized,
      updatedAt: serverTimestamp(),
    });

    // 2. Sync allowedEmails across people and results in chunked batches
    const targets: Array<{ col: 'people' | 'results'; id: string }> = [
      ...peopleIds.map((id) => ({ col: 'people' as const, id })),
      ...resultIds.map((id) => ({ col: 'results' as const, id })),
    ];

    for (let i = 0; i < targets.length; i += 400) {
      const batch = writeBatch(db);
      const chunk = targets.slice(i, i + 400);
      for (const item of chunk) {
        const ref = doc(db, 'workspaces', workspace.id, item.col, item.id);
        if (item.col === 'people') {
          batch.update(ref, {
            allowedEmails: sanitized,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(ref, {
            allowedEmails: sanitized,
          });
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, wsPath);
  }
}

export function subscribePeople(
  workspaceId: string,
  userEmail: string,
  onData: (people: Person[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `workspaces/${workspaceId}/people`;
  const email = userEmail.trim().toLowerCase();
  const q = query(collection(db, path), where('allowedEmails', 'array-contains', email));
  return onSnapshot(
    q,
    (snap) => {
      const list: Person[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          workspaceId: String(data.workspaceId ?? workspaceId),
          ownerId: String(data.ownerId ?? ''),
          allowedEmails: Array.isArray(data.allowedEmails) ? data.allowedEmails.map(String) : [],
          name: String(data.name ?? ''),
          code: String(data.code ?? ''),
          kind: (data.kind === 'employee' ? 'employee' : 'candidate') as PersonKind,
          dept: String(data.dept ?? ''),
          job: String(data.job ?? ''),
          age: String(data.age ?? ''),
          consent: Boolean(data.consent),
          created: Number(data.created ?? 0),
          createdByUid: String(data.createdByUid ?? ''),
          createdByEmail: String(data.createdByEmail ?? ''),
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      });
      list.sort((a, b) => b.created - a.created);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeResults(
  workspaceId: string,
  userEmail: string,
  onData: (results: TestResult[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const path = `workspaces/${workspaceId}/results`;
  const email = userEmail.trim().toLowerCase();
  const q = query(collection(db, path), where('allowedEmails', 'array-contains', email));
  return onSnapshot(
    q,
    (snap) => {
      const list: TestResult[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          workspaceId: String(data.workspaceId ?? workspaceId),
          personId: String(data.personId ?? ''),
          ownerId: String(data.ownerId ?? ''),
          allowedEmails: Array.isArray(data.allowedEmails) ? data.allowedEmails.map(String) : [],
          testId: data.testId as TestId,
          date: Number(data.date ?? 0),
          computerLabel: String(data.computerLabel ?? ''),
          recordedByUid: String(data.recordedByUid ?? ''),
          recordedByEmail: String(data.recordedByEmail ?? ''),
          examiner: String(data.examiner ?? ''),
          answers: Array.isArray(data.answers) ? data.answers.map(Number) : undefined,
          taskMetrics:
            data.taskMetrics && typeof data.taskMetrics === 'object'
              ? (data.taskMetrics as Record<string, unknown>)
              : undefined,
          dims: Array.isArray(data.dims) ? (data.dims as DimensionResult[]) : [],
          flags: Array.isArray(data.flags) ? (data.flags as ResultFlag[]) : [],
          createdAt: data.createdAt,
        };
      });
      list.sort((a, b) => b.date - a.date);
      onData(list);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createPerson(
  workspace: Workspace,
  user: User,
  input: {
    name: string;
    code: string;
    kind: PersonKind;
    dept: string;
    job: string;
    age: string;
    consent: boolean;
  }
): Promise<string> {
  const id = makeSafeId('p');
  const path = `workspaces/${workspace.id}/people/${id}`;
  const email = (user.email || '').trim().toLowerCase();
  try {
    await setDoc(doc(db, 'workspaces', workspace.id, 'people', id), {
      workspaceId: workspace.id,
      ownerId: workspace.ownerId,
      allowedEmails: workspace.allowedEmails,
      name: normStr(input.name, 120),
      code: normStr(input.code, 40),
      kind: input.kind,
      dept: normStr(input.dept, 100),
      job: normStr(input.job, 100),
      age: normStr(input.age, 10),
      consent: Boolean(input.consent),
      created: Date.now(),
      createdByUid: user.uid,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePerson(
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
): Promise<void> {
  const path = `workspaces/${workspaceId}/people/${personId}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'people', personId), {
      name: normStr(input.name, 120),
      code: normStr(input.code, 40),
      kind: input.kind,
      dept: normStr(input.dept, 100),
      job: normStr(input.job, 100),
      age: normStr(input.age, 10),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePersonAndResults(
  workspaceId: string,
  personId: string,
  resultIds: string[]
): Promise<void> {
  const path = `workspaces/${workspaceId}/people/${personId}`;
  try {
    for (let i = 0; i < resultIds.length; i += 400) {
      const batch = writeBatch(db);
      for (const rid of resultIds.slice(i, i + 400)) {
        batch.delete(doc(db, 'workspaces', workspaceId, 'results', rid));
      }
      await batch.commit();
    }
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'people', personId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createTestResult(
  workspace: Workspace,
  user: User,
  computerLabel: string,
  payload: {
    personId: string;
    testId: TestId;
    answers?: number[];
    taskMetrics?: Record<string, unknown>;
    dims: DimensionResult[];
    flags: ResultFlag[];
  }
): Promise<string> {
  const id = makeSafeId('r');
  const path = `workspaces/${workspace.id}/results/${id}`;
  const email = (user.email || '').trim().toLowerCase();
  const docPayload: Record<string, unknown> = {
    workspaceId: workspace.id,
    personId: payload.personId,
    ownerId: workspace.ownerId,
    allowedEmails: workspace.allowedEmails,
    testId: payload.testId,
    date: Date.now(),
    computerLabel: normStr(computerLabel || 'رایانه مشترک', 80),
    recordedByUid: user.uid,
    recordedByEmail: email,
    examiner: normStr(workspace.examiner, 120),
    dims: payload.dims.slice(0, 10),
    flags: payload.flags.slice(0, 10),
    createdAt: serverTimestamp(),
  };
  if (payload.answers !== undefined) {
    docPayload.answers = payload.answers.slice(0, 30);
  }
  if (payload.taskMetrics !== undefined) {
    docPayload.taskMetrics = payload.taskMetrics;
  }
  try {
    await setDoc(doc(db, 'workspaces', workspace.id, 'results', id), docPayload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTestResult(workspaceId: string, resultId: string): Promise<void> {
  const path = `workspaces/${workspaceId}/results/${resultId}`;
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'results', resultId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function wipeWorkspaceData(
  workspaceId: string,
  peopleIds: string[],
  resultIds: string[]
): Promise<void> {
  const path = `workspaces/${workspaceId}`;
  try {
    const allOps: Array<{ col: 'results' | 'people'; id: string }> = [
      ...resultIds.map((id) => ({ col: 'results' as const, id })),
      ...peopleIds.map((id) => ({ col: 'people' as const, id })),
    ];
    for (let i = 0; i < allOps.length; i += 400) {
      const batch = writeBatch(db);
      for (const op of allOps.slice(i, i + 400)) {
        batch.delete(doc(db, 'workspaces', workspaceId, op.col, op.id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
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
    dims?: DimensionResult[];
    flags?: ResultFlag[];
  }>;
}

export async function importBackupToWorkspace(
  workspace: Workspace,
  user: User,
  computerLabel: string,
  backup: { org?: string; examiner?: string; people: LegacyBackupPerson[] },
  mode: 'merge' | 'replace',
  existingPeople: Person[],
  existingResults: TestResult[]
): Promise<{ importedPeople: number; importedResults: number }> {
  const path = `workspaces/${workspace.id}`;
  const email = (user.email || '').trim().toLowerCase();
  try {
    if (mode === 'replace') {
      await wipeWorkspaceData(
        workspace.id,
        existingPeople.map((p) => p.id),
        existingResults.map((r) => r.id)
      );
      if (backup.org !== undefined || backup.examiner !== undefined) {
        await updateWorkspaceMeta(
          workspace.id,
          backup.org ?? workspace.org,
          backup.examiner ?? workspace.examiner
        );
      }
    }

    const existingIdSet = new Set(mode === 'replace' ? [] : existingPeople.map((p) => p.id));
    const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
    const personIdMap = new Map<string, string>();
    const peopleToCreate: Array<{ id: string; data: Record<string, unknown> }> = [];
    const resultsToCreate: Array<{ id: string; data: Record<string, unknown> }> = [];

    for (const rawP of backup.people) {
      if (!rawP || !rawP.name) continue;
      const rawId = rawP.id && safeIdPattern.test(rawP.id) ? rawP.id.slice(0, 128) : makeSafeId('p');
      if (existingIdSet.has(rawId)) continue;
      personIdMap.set(rawId, rawId);
      existingIdSet.add(rawId);

      peopleToCreate.push({
        id: rawId,
        data: {
          workspaceId: workspace.id,
          ownerId: workspace.ownerId,
          allowedEmails: workspace.allowedEmails,
          name: normStr(rawP.name, 120),
          code: normStr(rawP.code, 40),
          kind: rawP.kind === 'employee' ? 'employee' : 'candidate',
          dept: normStr(rawP.dept, 100),
          job: normStr(rawP.job, 100),
          age: normStr(rawP.age, 10),
          consent: true,
          created: Number(rawP.created || Date.now()),
          createdByUid: user.uid,
          createdByEmail: email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      });

      const rawResults = Array.isArray(rawP.results) ? rawP.results : [];
      for (const rawR of rawResults) {
        if (!rawR || !rawR.testId || !Array.isArray(rawR.dims) || rawR.dims.length === 0) continue;
        const rId =
          rawR.id && safeIdPattern.test(rawR.id) ? rawR.id.slice(0, 128) : makeSafeId('r');
        const resultObj: Record<string, unknown> = {
          workspaceId: workspace.id,
          personId: rawId,
          ownerId: workspace.ownerId,
          allowedEmails: workspace.allowedEmails,
          testId: rawR.testId,
          date: Number(rawR.date || Date.now()),
          computerLabel: normStr(computerLabel || 'بازیابی فایل پشتیبان', 80),
          recordedByUid: user.uid,
          recordedByEmail: email,
          examiner: normStr(workspace.examiner, 120),
          dims: rawR.dims.slice(0, 10),
          flags: Array.isArray(rawR.flags) ? rawR.flags.slice(0, 10) : [],
          createdAt: serverTimestamp(),
        };
        if (Array.isArray(rawR.data)) {
          resultObj.answers = rawR.data.map(Number).slice(0, 30);
        } else if (rawR.data && typeof rawR.data === 'object') {
          resultObj.taskMetrics = rawR.data as Record<string, unknown>;
        }
        resultsToCreate.push({ id: rId, data: resultObj });
      }
    }

    // Commit people first so results `exists(person)` rule passes
    for (let i = 0; i < peopleToCreate.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of peopleToCreate.slice(i, i + 400)) {
        batch.set(doc(db, 'workspaces', workspace.id, 'people', item.id), item.data);
      }
      await batch.commit();
    }

    for (let i = 0; i < resultsToCreate.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of resultsToCreate.slice(i, i + 400)) {
        batch.set(doc(db, 'workspaces', workspace.id, 'results', item.id), item.data);
      }
      await batch.commit();
    }

    return {
      importedPeople: peopleToCreate.length,
      importedResults: resultsToCreate.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
