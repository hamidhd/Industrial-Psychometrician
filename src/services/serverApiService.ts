import type {
  AppUser,
  DimensionResult,
  LegacyBackupPerson,
  ManagedAuthUser,
  Person,
  PersonKind,
  ResultFlag,
  TestId,
  TestResult,
  Workspace,
} from '../types/psychometrics';
import { normalizeBackendUrl } from '../utils/tauriBridge';

export interface ServerAuthStatus {
  ok: boolean;
  adminClaimed: boolean;
  envAdminConfigured: boolean;
  version?: string;
}

export interface ServerClientContext {
  baseUrl: string; // empty string '' for same-origin web, or normalized URL for Tauri
  token: string;
}

function buildUrl(baseUrl: string, path: string): string {
  const clean = normalizeBackendUrl(baseUrl);
  return `${clean}${path}`;
}

async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    token?: string;
    body?: unknown;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const resp = await fetch(buildUrl(baseUrl, path), {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
  });

  const payload = (await resp.json().catch(() => ({}))) as T & { error?: string };
  if (!resp.ok) {
    throw new Error(payload?.error || `خطای سرور (HTTP ${resp.status})`);
  }
  return payload;
}

export async function getServerAuthStatus(baseUrl: string): Promise<ServerAuthStatus> {
  return apiRequest<ServerAuthStatus>(baseUrl, '/api/auth/status', {
    method: 'GET',
    timeoutMs: 4000,
  });
}

export async function bootstrapServerAdmin(
  baseUrl: string,
  input: { username: string; password: string; name: string }
): Promise<{ token: string; user: AppUser }> {
  return apiRequest<{ token: string; user: AppUser }>(baseUrl, '/api/auth/bootstrap-admin', {
    method: 'POST',
    body: input,
  });
}

export async function loginServerAdmin(
  baseUrl: string,
  username: string,
  password: string
): Promise<{ token: string; user: AppUser }> {
  return apiRequest<{ token: string; user: AppUser }>(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { username, password },
  });
}

export async function loginServerPersonnel(
  baseUrl: string,
  identifier: string
): Promise<{ token: string; user: AppUser }> {
  return apiRequest<{ token: string; user: AppUser }>(baseUrl, '/api/auth/personnel-login', {
    method: 'POST',
    body: { identifier },
  });
}

export async function logoutServer(ctx: ServerClientContext): Promise<void> {
  if (!ctx.token) return;
  try {
    await apiRequest<{ ok: boolean }>(ctx.baseUrl, '/api/auth/logout', {
      method: 'POST',
      token: ctx.token,
      timeoutMs: 3000,
    });
  } catch {
    // best-effort logout
  }
}

export async function changeServerPassword(
  ctx: ServerClientContext,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(ctx.baseUrl, '/api/auth/change-password', {
    method: 'POST',
    token: ctx.token,
    body: { currentPassword, newPassword },
  });
}

export async function listServerUsers(ctx: ServerClientContext): Promise<ManagedAuthUser[]> {
  const res = await apiRequest<{ users: ManagedAuthUser[] }>(ctx.baseUrl, '/api/auth/users', {
    method: 'GET',
    token: ctx.token,
  });
  return Array.isArray(res.users) ? res.users : [];
}

export async function createServerUser(
  ctx: ServerClientContext,
  input: {
    username: string;
    name: string;
    dept: string;
    role: 'admin' | 'evaluator';
    password: string;
  }
): Promise<ManagedAuthUser> {
  const res = await apiRequest<{ user: ManagedAuthUser }>(ctx.baseUrl, '/api/auth/users', {
    method: 'POST',
    token: ctx.token,
    body: input,
  });
  return res.user;
}

export async function deleteServerUser(ctx: ServerClientContext, userId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    ctx.baseUrl,
    `/api/auth/users/${encodeURIComponent(userId)}`,
    {
      method: 'DELETE',
      token: ctx.token,
    }
  );
}

export async function fetchServerWorkspaces(ctx: ServerClientContext): Promise<Workspace[]> {
  const res = await apiRequest<{ workspaces: Workspace[] }>(ctx.baseUrl, '/api/workspaces', {
    method: 'GET',
    token: ctx.token,
  });
  return Array.isArray(res.workspaces) ? res.workspaces : [];
}

export async function createServerWorkspace(
  ctx: ServerClientContext,
  org: string,
  examiner: string
): Promise<string> {
  const res = await apiRequest<{ id: string }>(ctx.baseUrl, '/api/workspaces', {
    method: 'POST',
    token: ctx.token,
    body: { org, examiner },
  });
  return res.id;
}

export async function updateServerWorkspaceMeta(
  ctx: ServerClientContext,
  workspaceId: string,
  org: string,
  examiner: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/meta`,
    {
      method: 'PUT',
      token: ctx.token,
      body: { org, examiner },
    }
  );
}

export async function fetchServerWorkspaceData(
  ctx: ServerClientContext,
  workspaceId: string
): Promise<{ people: Person[]; results: TestResult[] }> {
  const res = await apiRequest<{ people: Person[]; results: TestResult[] }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/data`,
    {
      method: 'GET',
      token: ctx.token,
    }
  );
  return {
    people: Array.isArray(res.people) ? res.people : [],
    results: Array.isArray(res.results) ? res.results : [],
  };
}

export async function createServerPerson(
  ctx: ServerClientContext,
  workspaceId: string,
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
  const res = await apiRequest<{ id: string }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/people`,
    {
      method: 'POST',
      token: ctx.token,
      body: input,
    }
  );
  return res.id;
}

export async function batchCreateServerPeople(
  ctx: ServerClientContext,
  workspaceId: string,
  items: Array<{
    name: string;
    code: string;
    kind: PersonKind;
    dept: string;
    job: string;
    age: string;
  }>
): Promise<number> {
  const res = await apiRequest<{ added: number }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/people/batch`,
    {
      method: 'POST',
      token: ctx.token,
      body: { items },
      timeoutMs: 15000,
    }
  );
  return Number(res.added || 0);
}

export async function updateServerPerson(
  ctx: ServerClientContext,
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
  await apiRequest<{ ok: boolean }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/people/${encodeURIComponent(personId)}`,
    {
      method: 'PUT',
      token: ctx.token,
      body: input,
    }
  );
}

export async function deleteServerPerson(
  ctx: ServerClientContext,
  workspaceId: string,
  personId: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/people/${encodeURIComponent(personId)}`,
    {
      method: 'DELETE',
      token: ctx.token,
    }
  );
}

export async function createServerResult(
  ctx: ServerClientContext,
  workspaceId: string,
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
  const res = await apiRequest<{ id: string }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/results`,
    {
      method: 'POST',
      token: ctx.token,
      body: {
        ...payload,
        computerLabel,
      },
    }
  );
  return res.id;
}

export async function deleteServerResult(
  ctx: ServerClientContext,
  workspaceId: string,
  resultId: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/results/${encodeURIComponent(resultId)}`,
    {
      method: 'DELETE',
      token: ctx.token,
    }
  );
}

export async function wipeServerWorkspace(
  ctx: ServerClientContext,
  workspaceId: string
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/wipe`,
    {
      method: 'POST',
      token: ctx.token,
    }
  );
}

export async function importServerBackup(
  ctx: ServerClientContext,
  workspaceId: string,
  computerLabel: string,
  backup: { org?: string; examiner?: string; people: LegacyBackupPerson[] },
  mode: 'merge' | 'replace'
): Promise<{ importedPeople: number; importedResults: number }> {
  return apiRequest<{ importedPeople: number; importedResults: number }>(
    ctx.baseUrl,
    `/api/workspaces/${encodeURIComponent(workspaceId)}/import`,
    {
      method: 'POST',
      token: ctx.token,
      body: { mode, computerLabel, backup },
      timeoutMs: 20000,
    }
  );
}
