// OIDC Authorization Code + PKCE flow against Cognito Hosted UI.
// Zero runtime dependencies. Tokens live in sessionStorage (tab-scoped).
// Signatures are NOT verified client-side — token-exchange API and prosody enforce on the server.

const HOSTED_UI = 'https://cloud-del-norte.auth.us-west-2.amazoncognito.com';
const CLIENT_ID = '57eikmt418ea6vti2f6h0pl74r';
const SCOPES = 'openid email profile';

const KEY_ID_TOKEN = 'cdn.idToken';
const KEY_ACCESS_TOKEN = 'cdn.accessToken';
const KEY_REFRESH_TOKEN = 'cdn.refreshToken';
const KEY_EXPIRES_AT = 'cdn.expiresAt';
const KEY_LOGIN_STATE = 'cdn.loginState';

interface LoginState {
  pkceVerifier: string;
  returnTo: string;
}

interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

function redirectUri(): string {
  // Trailing slash matters: S3 website hosting issues a 302 Location: /auth/callback/
  // for the non-slash form, and the redirect drops the ?code query param.
  return `${window.location.origin}/auth/callback/`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

export async function beginLogin(returnTo?: string): Promise<void> {
  const verifier = randomVerifier();
  const challenge = await pkceChallenge(verifier);
  const state: LoginState = {
    pkceVerifier: verifier,
    returnTo: returnTo ?? window.location.pathname + window.location.search,
  };
  sessionStorage.setItem(KEY_LOGIN_STATE, JSON.stringify(state));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.assign(`${HOSTED_UI}/oauth2/authorize?${params.toString()}`);
}

export async function handleCallback(): Promise<{ returnTo: string }> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) throw new Error(`oidc error: ${error}`);
  if (!code) throw new Error('oidc callback missing code');

  const raw = sessionStorage.getItem(KEY_LOGIN_STATE);
  if (!raw) throw new Error('oidc callback missing login state');
  const state = JSON.parse(raw) as LoginState;
  sessionStorage.removeItem(KEY_LOGIN_STATE);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    code,
    redirect_uri: redirectUri(),
    code_verifier: state.pkceVerifier,
  });
  const res = await fetch(`${HOSTED_UI}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`oidc token exchange failed: ${res.status}`);
  const tokens = (await res.json()) as TokenResponse;
  storeTokens(tokens);
  return { returnTo: state.returnTo || '/' };
}

function storeTokens(tokens: TokenResponse): void {
  sessionStorage.setItem(KEY_ID_TOKEN, tokens.id_token);
  sessionStorage.setItem(KEY_ACCESS_TOKEN, tokens.access_token);
  if (tokens.refresh_token) sessionStorage.setItem(KEY_REFRESH_TOKEN, tokens.refresh_token);
  sessionStorage.setItem(KEY_EXPIRES_AT, String(Date.now() + tokens.expires_in * 1000));
}

function isExpired(): boolean {
  const raw = sessionStorage.getItem(KEY_EXPIRES_AT);
  if (!raw) return true;
  return Date.now() >= Number(raw);
}

export function getIdToken(): string | null {
  if (isExpired()) return null;
  return sessionStorage.getItem(KEY_ID_TOKEN);
}

export function getAccessToken(): string | null {
  if (isExpired()) return null;
  return sessionStorage.getItem(KEY_ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(KEY_REFRESH_TOKEN);
}

export async function refreshTokens(): Promise<void> {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('no refresh token');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: refresh,
  });
  const res = await fetch(`${HOSTED_UI}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`oidc refresh failed: ${res.status}`);
  const tokens = (await res.json()) as TokenResponse;
  // Cognito refresh response omits refresh_token — preserve existing.
  if (!tokens.refresh_token) tokens.refresh_token = refresh;
  storeTokens(tokens);
}

export function signOut(): void {
  sessionStorage.removeItem(KEY_ID_TOKEN);
  sessionStorage.removeItem(KEY_ACCESS_TOKEN);
  sessionStorage.removeItem(KEY_REFRESH_TOKEN);
  sessionStorage.removeItem(KEY_EXPIRES_AT);
  sessionStorage.removeItem(KEY_LOGIN_STATE);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: window.location.origin,
  });
  window.location.assign(`${HOSTED_UI}/logout?${params.toString()}`);
}

export function decodeToken(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2) throw new Error('malformed jwt');
  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = payload.length % 4;
  if (pad) payload += '='.repeat(4 - pad);
  const json = atob(payload);
  return JSON.parse(json) as Record<string, unknown>;
}
