// Wave 66 — babylon-budget.ts unit tests
import { afterEach, describe, expect, it } from "vitest";
import {
	MAX_ACTIVE_SCENES,
	activeScenes,
	releaseActivation,
	requestActivation,
} from "../babylon-budget";

afterEach(() => {
	// Reset shared state between tests
	activeScenes.clear();
});

describe("babylon-budget", () => {
	it("MAX_ACTIVE_SCENES is 2", () => {
		expect(MAX_ACTIVE_SCENES).toBe(2);
	});

	it("requestActivation under budget returns true", () => {
		expect(requestActivation("scene-a")).toBe(true);
		expect(activeScenes.has("scene-a")).toBe(true);
	});

	it("requestActivation for a second scene under budget returns true", () => {
		requestActivation("scene-a");
		expect(requestActivation("scene-b")).toBe(true);
		expect(activeScenes.size).toBe(2);
	});

	it("requestActivation over budget returns false", () => {
		requestActivation("scene-a");
		requestActivation("scene-b");
		// Third scene exceeds budget
		expect(requestActivation("scene-c")).toBe(false);
		expect(activeScenes.has("scene-c")).toBe(false);
		expect(activeScenes.size).toBe(2);
	});

	it("requestActivation is idempotent for already-active sceneId", () => {
		requestActivation("scene-a");
		requestActivation("scene-b");
		// Already active — returns true without incrementing size
		expect(requestActivation("scene-a")).toBe(true);
		expect(activeScenes.size).toBe(2);
	});

	it("releaseActivation frees a slot so a new scene can activate", () => {
		requestActivation("scene-a");
		requestActivation("scene-b");
		// Budget full — third fails
		expect(requestActivation("scene-c")).toBe(false);

		// Release one slot
		releaseActivation("scene-a");
		expect(activeScenes.has("scene-a")).toBe(false);

		// Now third can activate
		expect(requestActivation("scene-c")).toBe(true);
		expect(activeScenes.has("scene-c")).toBe(true);
	});

	it("releaseActivation on unknown sceneId is a no-op", () => {
		requestActivation("scene-a");
		// Should not throw
		expect(() => releaseActivation("scene-x")).not.toThrow();
		expect(activeScenes.size).toBe(1);
	});
});
