import React, { createContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { decodeToken, getIdToken, refreshTokens, signOut as doSignOut } from '../lib/auth';

export interface AuthState {
  isAuthenticated: boolean;
  idToken: string | null;
  email: string | null;
  name: string | null;
  groups: string[];
  isModerator: boolean;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

// Refresh when <20% of lifetime remains. Token lifetime read from exp claim.
const REFRESH_THRESHOLD_RATIO = 0.2;
const MIN_REFRESH_DELAY_MS = 30_000;

function readState(): AuthState {
  const idToken = getIdToken();
  if (!idToken) return emptyState();
  try {
    const claims = decodeToken(idToken);
    const groupsClaim = claims['cognito:groups'];
    const groups = Array.isArray(groupsClaim) ? (groupsClaim as string[]) : [];
    const email = typeof claims.email === 'string' ? claims.email : null;
    const name =
      typeof claims.name === 'string'
        ? claims.name
        : typeof claims['cognito:username'] === 'string'
          ? (claims['cognito:username'] as string)
          : null;
    return {
      isAuthenticated: true,
      idToken,
      email,
      name,
      groups,
      isModerator: groups.includes('moderators'),
      signOut: doSignOut,
    };
  } catch {
    return emptyState();
  }
}

function emptyState(): AuthState {
  return {
    isAuthenticated: false,
    idToken: null,
    email: null,
    name: null,
    groups: [],
    isModerator: false,
    signOut: doSignOut,
  };
}

function nextRefreshDelay(idToken: string): number | null {
  try {
    const claims = decodeToken(idToken);
    const exp = typeof claims.exp === 'number' ? claims.exp : null;
    const iat = typeof claims.iat === 'number' ? claims.iat : null;
    if (!exp) return null;
    const lifetimeMs = iat ? (exp - iat) * 1000 : (exp - Math.floor(Date.now() / 1000)) * 1000;
    const remainingMs = exp * 1000 - Date.now();
    const threshold = lifetimeMs * REFRESH_THRESHOLD_RATIO;
    return Math.max(MIN_REFRESH_DELAY_MS, remainingMs - threshold);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(() => readState());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setState(readState());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== sessionStorage) return;
      if (e.key && !e.key.startsWith('cdn.')) return;
      refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!state.idToken) return;
    const delay = nextRefreshDelay(state.idToken);
    if (delay === null) return;
    timerRef.current = setTimeout(async () => {
      try {
        await refreshTokens();
      } catch {
        // fall through — readState() will observe the expired token
      }
      refresh();
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.idToken, refresh]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
