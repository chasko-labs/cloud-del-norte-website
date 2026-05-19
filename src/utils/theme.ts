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

// Wave 42c — transition-window timer handle. The toggle handler adds
// body.cdn-theme-transitioning for ~240ms so the CSS rule in tokens.css
// can ease theme-bearing properties (background-color, color, border-color,
// fill, stroke) during the swap. Stored at module scope so repeated rapid
// toggles cancel the in-flight removal and re-arm a fresh window — without
// the cancel a quick double-click would remove the class mid-transition on
// the second flip and the second swap would snap instead of ease.
let pendingTransitionHandle: number | null = null;
const THEME_TRANSITION_CLASS = "cdn-theme-transitioning";
const THEME_TRANSITION_DURATION_MS = 240;

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
	// FIRST-PAINT SYNC PATH (wave-25c): when this is the very first apply
	// (lastAppliedMode === null), skeletons are about to mount on the same
	// frame. Deferring applyMode via requestIdleCallback (up to 200ms below)
	// leaves Cloudscape's design-token table out of sync with the
	// awsui-dark-mode class that the inline <head> guard already set on
	// <html> — so skeletons render against half-themed tokens for that
	// window. That's the "stick" Bryan reported. Run synchronously on the
	// first apply so the first commit has both class and tokens aligned.
	// Subsequent toggles still use the idle/rAF schedule below to keep
	// click-feel instant.
	if (lastAppliedMode === null) {
		lastAppliedMode = mode;
		applyMode(mode);
		return;
	}
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
	// Wave 42c — open a transition window so theme-bearing properties
	// (background-color, color, border-color, fill, stroke) ease to the
	// new value instead of snapping. Skip on the very first apply: the
	// wave 25c FOUC guard already aligned the awsui-dark-mode class on
	// <html> at parse-time, so the class toggle below is a no-op for the
	// initial mount and there is nothing to animate. Subsequent toggles
	// (user clicks the picker, system preference change) are real swaps
	// and benefit from the eased transition. Body availability is checked
	// because applyTheme can run before body mounts in unusual entry
	// orderings — the transition is a nice-to-have, not load-bearing.
	const isFirstApply = lastAppliedMode === null;
	if (
		!isFirstApply &&
		typeof document !== "undefined" &&
		document.body !== null
	) {
		document.body.classList.add(THEME_TRANSITION_CLASS);
		// Cancel any in-flight removal from a previous rapid toggle so the
		// fresh window's full duration is honored. Without this, a quick
		// double-click would strip the class mid-transition on the second
		// flip and the second swap would snap instead of ease.
		if (pendingTransitionHandle !== null) {
			clearTimeout(pendingTransitionHandle);
		}
		pendingTransitionHandle = window.setTimeout(() => {
			pendingTransitionHandle = null;
			document.body.classList.remove(THEME_TRANSITION_CLASS);
		}, THEME_TRANSITION_DURATION_MS);
	}

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
