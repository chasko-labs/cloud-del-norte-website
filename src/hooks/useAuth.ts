import { useContext } from 'react';
import { AuthContext } from '../contexts/auth-context';
import type { AuthState } from '../contexts/auth-context';

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
