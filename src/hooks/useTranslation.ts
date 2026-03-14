import { useContext } from 'react';
import { LocaleContext } from '../contexts/locale-context';
import type { LocaleContextValue } from '../contexts/locale-context';

export function useTranslation(): LocaleContextValue {
  return useContext(LocaleContext);
}
