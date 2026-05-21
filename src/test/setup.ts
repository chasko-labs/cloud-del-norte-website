import { vi } from "vitest";

// Cloudscape components use ResizeObserver internally — not in jsdom.
// Must be a real class (not an arrow fn) so `new ResizeObserver()` works.
class ResizeObserverMock {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver =
	ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock IntersectionObserver for jsdom (atmosphere-ribbon uses it)
if (typeof IntersectionObserver === "undefined") {
	global.IntersectionObserver = class MockIntersectionObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof IntersectionObserver;
}

// Cloudscape also reads window.matchMedia
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

import "@testing-library/jest-dom";
