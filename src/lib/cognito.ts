// Direct Cognito API calls for custom auth forms.
// No AWS SDK — raw fetch against the regional endpoint.
// Tokens stored in sessionStorage (tab-scoped, same policy as auth.ts).

const REGION = 'us-west-2';
const CLIENT_ID = '57eikmt418ea6vti2f6h0pl74r';
const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

const KEY_ID_TOKEN = 'cdn.idToken';
const KEY_ACCESS_TOKEN = 'cdn.accessToken';
const KEY_REFRESH_TOKEN = 'cdn.refreshToken';
const KEY_EXPIRES_AT = 'cdn.expiresAt';

// ---- Input sanitization ----

export const FIELD_LIMITS: Record<string, number> = {
  email: 254,
  password: 256,
  member_type: 200,
  location: 100,
  topics: 500,
  background: 1000,
  code: 10,
};

export function sanitize(value: string, field: keyof typeof FIELD_LIMITS): string {
  const trimmed = value.trim();
  const limit = FIELD_LIMITS[field] ?? 256;
  return trimmed.slice(0, limit);
}

export function assertNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new AuthError(`${label} is required`);
}

// ---- Error type ----

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ---- Cognito fetch helper ----

async function cognitoPost(target: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const code = (json.__type as string | undefined) ?? 'UnknownError';
    const msg = (json.message as string | undefined) ?? 'An error occurred';
    throw new AuthError(msg, code);
  }
  return json;
}

// ---- Token storage ----

function storeTokens(result: Record<string, unknown>): void {
  const auth = result.AuthenticationResult as Record<string, unknown>;
  sessionStorage.setItem(KEY_ID_TOKEN, auth.IdToken as string);
  sessionStorage.setItem(KEY_ACCESS_TOKEN, auth.AccessToken as string);
  if (auth.RefreshToken) sessionStorage.setItem(KEY_REFRESH_TOKEN, auth.RefreshToken as string);
  sessionStorage.setItem(KEY_EXPIRES_AT, String(Date.now() + (auth.ExpiresIn as number) * 1000));
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

export function clearTokens(): void {
  [KEY_ID_TOKEN, KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN, KEY_EXPIRES_AT].forEach(k => sessionStorage.removeItem(k));
}

export function decodeToken(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2) throw new AuthError('malformed jwt');
  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const pad = payload.length % 4;
  if (pad) payload += '='.repeat(4 - pad);
  return JSON.parse(atob(payload)) as Record<string, unknown>;
}

// ---- Auth actions ----

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const result = await cognitoPost('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: sanitize(email, 'email'),
      PASSWORD: password,
    },
  });
  storeTokens(result);
}

export interface SignUpFields {
  email: string;
  password: string;
  memberType: string;
  location: string;
  topics: string;
  background: string;
}

export async function signUp(fields: SignUpFields): Promise<void> {
  await cognitoPost('SignUp', {
    ClientId: CLIENT_ID,
    Username: sanitize(fields.email, 'email'),
    Password: fields.password,
    UserAttributes: [
      { Name: 'email', Value: sanitize(fields.email, 'email') },
      { Name: 'custom:member_type', Value: sanitize(fields.memberType, 'member_type') },
      { Name: 'custom:location', Value: sanitize(fields.location, 'location') },
      { Name: 'custom:topics', Value: sanitize(fields.topics, 'topics') },
      { Name: 'custom:background', Value: sanitize(fields.background, 'background') },
    ],
  });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await cognitoPost('ConfirmSignUp', {
    ClientId: CLIENT_ID,
    Username: sanitize(email, 'email'),
    ConfirmationCode: sanitize(code, 'code'),
  });
}

export async function resendConfirmationCode(email: string): Promise<void> {
  await cognitoPost('ResendConfirmationCode', {
    ClientId: CLIENT_ID,
    Username: sanitize(email, 'email'),
  });
}

export async function forgotPassword(email: string): Promise<void> {
  await cognitoPost('ForgotPassword', {
    ClientId: CLIENT_ID,
    Username: sanitize(email, 'email'),
  });
}

export async function confirmForgotPassword(email: string, code: string, newPassword: string): Promise<void> {
  await cognitoPost('ConfirmForgotPassword', {
    ClientId: CLIENT_ID,
    Username: sanitize(email, 'email'),
    ConfirmationCode: sanitize(code, 'code'),
    Password: newPassword,
  });
}

export async function refreshTokens(): Promise<void> {
  const refresh = getRefreshToken();
  if (!refresh) throw new AuthError('no refresh token');
  const result = await cognitoPost('InitiateAuth', {
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { REFRESH_TOKEN: refresh },
  });
  const auth = result.AuthenticationResult as Record<string, unknown>;
  if (!auth.RefreshToken) auth.RefreshToken = refresh;
  storeTokens(result);
}
