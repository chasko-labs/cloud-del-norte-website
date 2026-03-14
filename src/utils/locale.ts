export type Locale = 'us' | 'mx';

const LOCALE_KEY = 'cdn-locale';

export const getStoredLocale = (): Locale => {
  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored === 'us' || stored === 'mx') return stored;
  return 'us';
};

export const setStoredLocale = (locale: Locale): void => {
  localStorage.setItem(LOCALE_KEY, locale);
};

export const applyLocale = (locale: Locale): void => {
  document.documentElement.lang = locale === 'mx' ? 'es-MX' : 'en-US';
  document.documentElement.setAttribute('data-locale', locale);
};

export const initializeLocale = (): Locale => {
  const locale = getStoredLocale();
  applyLocale(locale);
  return locale;
};
