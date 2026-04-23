import { getIdToken, refreshTokens } from './auth';

const API_BASE = 'https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com';
const TOKEN_PATH = '/token/jitsi';

export interface JitsiTokenResponse {
  token: string;
  domain: string;
  expiresAt: number;
}

export class BannedUserError extends Error {
  constructor(message = 'user is banned') {
    super(message);
    this.name = 'BannedUserError';
  }
}

let cached: JitsiTokenResponse | null = null;

export function clearJitsiTokenCache(): void {
  cached = null;
}

async function requestToken(idToken: string): Promise<Response> {
  return fetch(`${API_BASE}${TOKEN_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
}

export async function fetchJitsiToken(): Promise<JitsiTokenResponse> {
  if (cached && cached.expiresAt * 1000 > Date.now() + 30_000) return cached;

  let idToken = getIdToken();
  if (!idToken) throw new Error('not authenticated');

  let res = await requestToken(idToken);

  if (res.status === 401) {
    await refreshTokens();
    idToken = getIdToken();
    if (!idToken) throw new Error('refresh failed — not authenticated');
    res = await requestToken(idToken);
    if (res.status === 401) throw new Error('token-exchange unauthorized after refresh');
  }

  if (res.status === 403) throw new BannedUserError();
  if (!res.ok) throw new Error(`token-exchange failed: ${res.status}`);

  const body = (await res.json()) as JitsiTokenResponse;
  cached = body;
  return body;
}
