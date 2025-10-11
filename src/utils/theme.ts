import { Mode, applyMode } from '@cloudscape-design/global-styles';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'awsaerospace-theme';

export const getStoredTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const setStoredTheme = (theme: Theme): void => {
  localStorage.setItem(THEME_KEY, theme);
};

export const applyTheme = (theme: Theme): void => {
  const mode: Mode = theme === 'dark' ? Mode.Dark : Mode.Light;
  applyMode(mode);
  document.documentElement.classList.toggle('awsui-dark-mode', theme === 'dark');
};

export const initializeTheme = (): Theme => {
  const theme = getStoredTheme();
  applyTheme(theme);
  return theme;
};
