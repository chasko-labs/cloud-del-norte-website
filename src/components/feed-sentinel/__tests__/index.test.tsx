import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedSentinel } from "../index";

// ── IntersectionObserver mock ────────────────────────────────────────────────
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let lastCallback: IOCallback | null = null;
let lastOptions: IntersectionObserverInit | null = null;
// Holds the most-recently created mock instance so tests can call its methods
let lastInstance: {
	disconnect: ReturnType<typeof vi.fn>;
	trigger: IOCallback;
} | null = null;

beforeEach(() => {
	lastCallback = null;
	lastOptions = null;
	lastInstance = null;

	class IntersectionObserverMock {
		disconnect = vi.fn();
		constructor(cb: IOCallback, opts?: IntersectionObserverInit) {
			lastCallback = cb;
			lastOptions = opts ?? null;

			lastInstance = {
				disconnect: this.disconnect,
				trigger: cb,
			};
		}
		observe() {}
	}

	globalThis.IntersectionObserver =
		IntersectionObserverMock as unknown as typeof IntersectionObserver;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("FeedSentinel", () => {
	it("instantiates IntersectionObserver with correct options", () => {
		render(<FeedSentinel onVisible={vi.fn()} hasMore={true} />);
		expect(lastOptions).toMatchObject({ rootMargin: "400px", threshold: 0.1 });
	});

	it("calls onVisible when entry is intersecting", () => {
		const onVisible = vi.fn();
		render(<FeedSentinel onVisible={onVisible} hasMore={true} />);
		lastCallback?.([{ isIntersecting: true } as IntersectionObserverEntry]);
		expect(onVisible).toHaveBeenCalledTimes(1);
	});

	it("does not call onVisible when entry is not intersecting", () => {
		const onVisible = vi.fn();
		render(<FeedSentinel onVisible={onVisible} hasMore={true} />);
		lastCallback?.([{ isIntersecting: false } as IntersectionObserverEntry]);
		expect(onVisible).not.toHaveBeenCalled();
	});

	it("returns null when hasMore is false", () => {
		const { container } = render(
			<FeedSentinel onVisible={vi.fn()} hasMore={false} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("does not instantiate IntersectionObserver when hasMore is false", () => {
		render(<FeedSentinel onVisible={vi.fn()} hasMore={false} />);
		expect(lastCallback).toBeNull();
	});

	it("disconnects observer on unmount", () => {
		const { unmount } = render(
			<FeedSentinel onVisible={vi.fn()} hasMore={true} />,
		);
		expect(lastInstance).not.toBeNull();
		unmount();
		expect(lastInstance?.disconnect).toHaveBeenCalledTimes(1);
	});
});
