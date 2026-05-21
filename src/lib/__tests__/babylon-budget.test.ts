// Wave 66 — babylon-budget.ts unit tests
import { afterEach, describe, expect, it } from "vitest";
import {
	activeScenes,
	MAX_ACTIVE_SCENES,
	releaseActivation,
	requestActivation,
} from "../babylon-budget";

afterEach(() => {
	// Reset shared state between tests
	activeScenes.clear();
});

describe("babylon-budget", () => {
	it("MAX_ACTIVE_SCENES is 3", () => {
		expect(MAX_ACTIVE_SCENES).toBe(3);
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
		requestActivation("scene-c");
		// Fourth scene exceeds budget
		expect(requestActivation("scene-d")).toBe(false);
		expect(activeScenes.has("scene-d")).toBe(false);
		expect(activeScenes.size).toBe(3);
	});

	it("requestActivation is idempotent for already-active sceneId", () => {
		requestActivation("scene-a");
		requestActivation("scene-b");
		requestActivation("scene-c");
		// Already active — returns true without incrementing size
		expect(requestActivation("scene-a")).toBe(true);
		expect(activeScenes.size).toBe(3);
	});

	it("releaseActivation frees a slot so a new scene can activate", () => {
		requestActivation("scene-a");
		requestActivation("scene-b");
		requestActivation("scene-c");
		// Budget full — fourth fails
		expect(requestActivation("scene-d")).toBe(false);

		// Release one slot
		releaseActivation("scene-a");
		expect(activeScenes.has("scene-a")).toBe(false);

		// Now fourth can activate
		expect(requestActivation("scene-d")).toBe(true);
		expect(activeScenes.has("scene-d")).toBe(true);
	});

	it("releaseActivation on unknown sceneId is a no-op", () => {
		requestActivation("scene-a");
		// Should not throw
		expect(() => releaseActivation("scene-x")).not.toThrow();
		expect(activeScenes.size).toBe(1);
	});
});
