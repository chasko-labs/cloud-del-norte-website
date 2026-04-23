import { getIdToken, refreshTokens } from './auth';

const API_BASE = 'https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com';

export interface AdminUser {
  sub: string;
  email: string;
  status: string;
  groups: string[];
  createdAt: string;
}

export interface ListUsersResponse {
  users: AdminUser[];
}

export interface ApproveUserResponse {
  ok: boolean;
  user: AdminUser;
}

async function adminRequest(path: string, method: string, body?: unknown): Promise<Response> {
  const idToken = getIdToken();
  if (!idToken) throw new Error('not authenticated');
  return fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function withRetry<T>(fn: () => Promise<Response>, parse: (r: Response) => Promise<T>): Promise<T> {
  let res = await fn();
  if (res.status === 401) {
    await refreshTokens();
    res = await fn();
    if (res.status === 401) throw new Error('unauthorized after refresh');
  }
  if (!res.ok) throw new Error(`admin api error: ${res.status}`);
  return parse(res);
}

export async function listPendingUsers(filter: 'pending' | 'members' | 'moderators' | 'banned' = 'pending'): Promise<AdminUser[]> {
  const result = await withRetry(
    () => adminRequest(`/admin/users?filter=${filter}`, 'GET'),
    (r) => r.json() as Promise<ListUsersResponse>,
  );
  return result.users;
}

export async function approveUser(sub: string, group: 'members' | 'moderators' = 'members'): Promise<ApproveUserResponse> {
  return withRetry(
    () => adminRequest(`/admin/users/${encodeURIComponent(sub)}/approve`, 'POST', { group }),
    (r) => r.json() as Promise<ApproveUserResponse>,
  );
}

export async function banUser(sub: string): Promise<ApproveUserResponse> {
  return withRetry(
    () => adminRequest(`/admin/users/${encodeURIComponent(sub)}/ban`, 'POST'),
    (r) => r.json() as Promise<ApproveUserResponse>,
  );
}
