// Wave 66 — Babylon scene budget manager.
// Limits concurrent WebGL contexts to MAX_ACTIVE_SCENES.
// Each Babylon-mounting component calls requestActivation before creating an
// Engine and releaseActivation in its cleanup path.

export const MAX_ACTIVE_SCENES = 2;

export const activeScenes: Set<string> = new Set();

/**
 * Request activation for a scene slot.
 * Returns true if the budget has room; false if the caller must wait.
 * Idempotent: requesting an already-active sceneId returns true immediately.
 */
export function requestActivation(sceneId: string): boolean {
	if (activeScenes.has(sceneId)) return true;
	if (activeScenes.size >= MAX_ACTIVE_SCENES) return false;
	activeScenes.add(sceneId);
	return true;
}

/**
 * Release a scene's activation slot so another scene can take it.
 * Safe to call even if sceneId was never activated (no-op).
 */
export function releaseActivation(sceneId: string): void {
	activeScenes.delete(sceneId);
}
