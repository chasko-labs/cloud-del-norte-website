import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const HOSTED_UI = 'https://cloud-del-norte.auth.us-west-2.amazoncognito.com';
const CLIENT_ID = '57eikmt418ea6vti2f6h0pl74r';

describe('auth module', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('decodeToken', () => {
    it('decodes a standard JWT payload', async () => {
      const { decodeToken } = await import('../auth');
      // header.payload.sig  — payload = {"sub":"abc","email":"a@b.co"}
      const jwt = 'h.eyJzdWIiOiJhYmMiLCJlbWFpbCI6ImFAYi5jbyJ9.sig';
      expect(decodeToken(jwt)).toEqual({ sub: 'abc', email: 'a@b.co' });
    });

    it('handles base64url padding', async () => {
      const { decodeToken } = await import('../auth');
      // {"a":1} base64url is "eyJhIjoxfQ" (no padding)
      const jwt = 'h.eyJhIjoxfQ.sig';
      expect(decodeToken(jwt)).toEqual({ a: 1 });
    });

    it('throws on malformed jwt', async () => {
      const { decodeToken } = await import('../auth');
      expect(() => decodeToken('not-a-jwt')).toThrow();
    });
  });

  describe('getIdToken / getAccessToken', () => {
    it('returns null when storage is empty', async () => {
      const { getIdToken, getAccessToken } = await import('../auth');
      expect(getIdToken()).toBeNull();
      expect(getAccessToken()).toBeNull();
    });

    it('returns null when tokens are expired', async () => {
      sessionStorage.setItem('cdn.idToken', 'id-123');
      sessionStorage.setItem('cdn.accessToken', 'ac-123');
      sessionStorage.setItem('cdn.expiresAt', String(Date.now() - 1000));
      const { getIdToken, getAccessToken } = await import('../auth');
      expect(getIdToken()).toBeNull();
      expect(getAccessToken()).toBeNull();
    });

    it('returns tokens when not expired', async () => {
      sessionStorage.setItem('cdn.idToken', 'id-abc');
      sessionStorage.setItem('cdn.accessToken', 'ac-abc');
      sessionStorage.setItem('cdn.expiresAt', String(Date.now() + 60_000));
      const { getIdToken, getAccessToken } = await import('../auth');
      expect(getIdToken()).toBe('id-abc');
      expect(getAccessToken()).toBe('ac-abc');
    });
  });

  describe('getRefreshToken', () => {
    it('returns stored refresh token even if access is expired', async () => {
      sessionStorage.setItem('cdn.refreshToken', 'rf-xyz');
      sessionStorage.setItem('cdn.expiresAt', String(Date.now() - 1000));
      const { getRefreshToken } = await import('../auth');
      expect(getRefreshToken()).toBe('rf-xyz');
    });
  });

  describe('beginLogin', () => {
    it('stores PKCE verifier + returnTo and redirects to Cognito authorize', async () => {
      const assign = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.test', pathname: '/meetings', search: '?x=1', assign },
        writable: true,
      });
      const { beginLogin } = await import('../auth');
      await beginLogin();

      const raw = sessionStorage.getItem('cdn.loginState');
      expect(raw).not.toBeNull();
      const state = JSON.parse(raw as string);
      expect(state.pkceVerifier).toMatch(/^[A-Za-z0-9_-]{40,}$/);
      expect(state.returnTo).toBe('/meetings?x=1');

      expect(assign).toHaveBeenCalledTimes(1);
      const target = assign.mock.calls[0][0] as string;
      expect(target.startsWith(`${HOSTED_UI}/oauth2/authorize?`)).toBe(true);
      const params = new URLSearchParams(target.split('?')[1]);
      expect(params.get('client_id')).toBe(CLIENT_ID);
      expect(params.get('response_type')).toBe('code');
      expect(params.get('code_challenge_method')).toBe('S256');
      expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(params.get('redirect_uri')).toBe('https://example.test/auth/callback/');
      expect(params.get('scope')).toBe('openid email profile');
    });

    it('produces a valid SHA-256 challenge of the verifier', async () => {
      const assign = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.test', pathname: '/', search: '', assign },
        writable: true,
      });
      const { beginLogin } = await import('../auth');
      await beginLogin('/after');

      const state = JSON.parse(sessionStorage.getItem('cdn.loginState') as string);
      const verifier: string = state.pkceVerifier;

      const target = assign.mock.calls[0][0] as string;
      const challenge = new URLSearchParams(target.split('?')[1]).get('code_challenge')!;

      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      const bytes = new Uint8Array(digest);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const expected = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      expect(challenge).toBe(expected);
    });
  });

  describe('signOut', () => {
    it('clears tokens and redirects to Cognito logout', async () => {
      sessionStorage.setItem('cdn.idToken', 'x');
      sessionStorage.setItem('cdn.accessToken', 'x');
      sessionStorage.setItem('cdn.refreshToken', 'x');
      sessionStorage.setItem('cdn.expiresAt', String(Date.now() + 60_000));
      const assign = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { origin: 'https://example.test', assign },
        writable: true,
      });
      const { signOut } = await import('../auth');
      signOut();

      expect(sessionStorage.getItem('cdn.idToken')).toBeNull();
      expect(sessionStorage.getItem('cdn.accessToken')).toBeNull();
      expect(sessionStorage.getItem('cdn.refreshToken')).toBeNull();
      expect(sessionStorage.getItem('cdn.expiresAt')).toBeNull();
      expect(assign).toHaveBeenCalledTimes(1);
      const target = assign.mock.calls[0][0] as string;
      expect(target.startsWith(`${HOSTED_UI}/logout?`)).toBe(true);
      const params = new URLSearchParams(target.split('?')[1]);
      expect(params.get('client_id')).toBe(CLIENT_ID);
      expect(params.get('logout_uri')).toBe('https://example.test');
    });
  });
});
