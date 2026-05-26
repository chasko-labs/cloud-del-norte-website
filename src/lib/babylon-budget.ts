// Wave 66 — Babylon scene budget manager.
// Limits concurrent WebGL contexts to MAX_ACTIVE_SCENES.
// Each Babylon-mounting component calls requestActivation before creating an
// Engine and releaseActivation in its cleanup path.

export const MAX_ACTIVE_SCENES = 2;

export const activeScenes: Set<string> = new Set();

// Insertion-order tracks LRU — oldest entry is first in iteration order.
// Persistent scenes (listed here) are never evicted by forceReleaseLRU.
const PERSISTENT_SCENES = new Set<string>([
	"atmosphere-scene",
	"atmosphere-ribbon",
	"babylon-spin-demo",
	"cdn-star-logo",
]);

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

/**
 * Evict the oldest non-persistent scene to make room for a persistent one.
 * Returns true if a slot was freed; false if no evictable scene exists.
 */
export function forceReleaseLRU(): boolean {
	for (const id of activeScenes) {
		if (!PERSISTENT_SCENES.has(id)) {
			activeScenes.delete(id);
			return true;
		}
	}
	return false;
}
