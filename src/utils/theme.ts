import { applyMode, Mode } from "@cloudscape-design/global-styles";

export type Theme = "light" | "dark";

const THEME_KEY = "awsaerospace-theme";

const getSystemPreference = (): Theme => {
	if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
		return "dark";
	}
	return "light";
};

export const getStoredTheme = (): Theme => {
	const stored = localStorage.getItem(THEME_KEY);
	if (stored === "dark" || stored === "light") return stored;
	return getSystemPreference();
};

export const setStoredTheme = (theme: Theme): void => {
	localStorage.setItem(THEME_KEY, theme);
};

export const applyTheme = (theme: Theme): void => {
	// IMMEDIATE: toggle the html class so our CSS palette + the wallpaper
	// MutationObserver react synchronously. User sees the surface flip
	// (light ↔ dark) within the same frame they clicked.
	document.documentElement.classList.toggle(
		"awsui-dark-mode",
		theme === "dark",
	);
	// DEFERRED: Cloudscape's applyMode walks the design-token table and
	// rewrites custom-property values across every component subtree. On
	// large pages that's 30-80ms of synchronous work. Push it to the next
	// paint so the click feels instant — the user has already seen our
	// CSS-driven palette flip on the same frame.
	const mode: Mode = theme === "dark" ? Mode.Dark : Mode.Light;
	if (typeof requestAnimationFrame !== "undefined") {
		requestAnimationFrame(() => applyMode(mode));
	} else {
		applyMode(mode);
	}
};

export const initializeTheme = (): Theme => {
	const theme = getStoredTheme();
	applyTheme(theme);
	return theme;
};

export const watchSystemPreference = (
	onChange: (theme: Theme) => void,
): (() => void) => {
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

	const handler = (e: MediaQueryListEvent) => {
		const stored = localStorage.getItem(THEME_KEY);
		if (stored === null) {
			const newTheme = e.matches ? "dark" : "light";
			onChange(newTheme);
		}
	};

	mediaQuery.addEventListener("change", handler);

	return () => {
		mediaQuery.removeEventListener("change", handler);
	};
};
