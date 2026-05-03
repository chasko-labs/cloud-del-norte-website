import { applyMode, Mode } from "@cloudscape-design/global-styles";

export type Theme = "light" | "dark";

const THEME_KEY = "awsaerospace-theme";

// In-memory cache of the last-applied Cloudscape mode. localStorage is fast
// (~0.05ms read) but applyMode itself walks the design-token table and is
// the actual cost. Skipping a redundant applyMode (e.g. the user clicks the
// already-active mode) saves 30-80ms even though the CSS class toggle is a
// no-op for the user.
let lastAppliedMode: Mode | null = null;
let pendingApplyHandle: number | null = null;

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

// Schedule applyMode at the soonest non-blocking moment. Prefers the idle
// callback (browser will fit the work into a free slice up to 200ms after
// user input), falls back to rAF (next paint), then sync. Coalesces
// back-to-back theme toggles via the pendingApplyHandle guard — matters
// when a user double-clicks the picker or a programmatic flip races a
// system-preference change.
const scheduleApplyMode = (mode: Mode): void => {
	if (lastAppliedMode === mode) return;
	if (pendingApplyHandle !== null) {
		// A previous schedule is in-flight. Cancel it and re-queue with the
		// freshest mode — applyMode is expensive enough that running it
		// twice for a quick double-flip is worse than running it once with
		// the final value.
		const w = window as unknown as {
			cancelIdleCallback?: (h: number) => void;
		};
		if (typeof w.cancelIdleCallback === "function") {
			w.cancelIdleCallback(pendingApplyHandle);
		} else {
			cancelAnimationFrame(pendingApplyHandle);
		}
		pendingApplyHandle = null;
	}
	const run = (): void => {
		pendingApplyHandle = null;
		lastAppliedMode = mode;
		// performance.now() expectation pre-fix: 30-80ms (token-table walk).
		// We don't measure here — Cloudscape internals own the cost — but
		// the schedule moves it OFF the click frame so the click feels
		// instant regardless.
		applyMode(mode);
	};
	const w = window as unknown as {
		requestIdleCallback?: (
			cb: () => void,
			opts?: { timeout?: number },
		) => number;
	};
	if (typeof w.requestIdleCallback === "function") {
		// 200ms timeout cap — applyMode must run before any subsequent
		// Cloudscape token read fires (e.g. a re-render that consults a
		// custom prop). 200ms is the upper bound on perceptible lag.
		pendingApplyHandle = w.requestIdleCallback(run, { timeout: 200 });
	} else if (typeof requestAnimationFrame !== "undefined") {
		pendingApplyHandle = requestAnimationFrame(run);
	} else {
		run();
	}
};

export const applyTheme = (theme: Theme): void => {
	// IMMEDIATE: toggle the html class so our CSS palette + the wallpaper
	// MutationObserver react synchronously. User sees the surface flip
	// (light ↔ dark) within the same frame they clicked.
	// performance.now() expectation: <1ms (single classList op + the
	// MutationObserver firing schedules its own rAF for the scene swap).
	document.documentElement.classList.toggle(
		"awsui-dark-mode",
		theme === "dark",
	);
	// DEFERRED: Cloudscape's applyMode walks the design-token table and
	// rewrites custom-property values across every component subtree. On
	// large pages that's 30-80ms of synchronous work. Push it to the next
	// idle slice so the click feels instant — the user has already seen
	// our CSS-driven palette flip on the same frame.
	const mode: Mode = theme === "dark" ? Mode.Dark : Mode.Light;
	scheduleApplyMode(mode);
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
