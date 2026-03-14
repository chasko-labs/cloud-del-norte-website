import React, { createContext } from 'react';
import type { Locale } from '../utils/locale';
import enUS from '../locales/en-US.json';
import esMX from '../locales/es-MX.json';

const translations: Record<Locale, Record<string, unknown>> = {
  us: enUS,
  mx: esMX,
};

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return path;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : path;
}

export interface LocaleContextValue {
  locale: Locale;
  t: (key: string) => string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'us',
  t: (key: string) => key,
});

interface LocaleProviderProps {
  locale: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const t = (key: string): string => {
    const value = getNestedValue(translations[locale], key);
    if (value !== key) return value;
    return getNestedValue(translations.us, key);
  };

  return (
    <LocaleContext.Provider value={{ locale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}
