// Issue #382 — thin wrapper over device-capabilities.getDeviceDiagnostics().
//
// Historically render-capability.ts ran its own duplicate WebGL probe with
// a slightly drifted regex. Now it delegates to the canonical probe so we
// have a single source of truth for the WebGL signal across dune,
// cdn-star-logo, and the BabylonGate-based scenes.
//
// Public API shape preserved for backward compat with existing callers in
// src/dune/SceneBootstrap.ts and src/lib/cdn-star-logo/.

import { getDeviceDiagnostics } from "./device-capabilities";

export interface RenderCapability {
	hardwareWebgl: boolean;
	reducedMotion: boolean;
	/** True if we should render the full 3D scene; false if a static fallback should be used */
	shouldRenderRichScene: boolean;
	/** The UNMASKED_RENDERER_WEBGL string, useful for diagnostics. "no-webgl" when WebGL unavailable. */
	rendererString: string;
}

export function detectRenderCapability(): RenderCapability {
	// SSR / Node guard — device-capabilities assumes window/document.
	if (typeof window === "undefined" || typeof document === "undefined") {
		return {
			hardwareWebgl: false,
			reducedMotion: false,
			shouldRenderRichScene: false,
			rendererString: "",
		};
	}

	const d = getDeviceDiagnostics();

	// hardwareWebgl: WebGL context exists, has a non-empty renderer string, and
	// it does not match the software-renderer pattern. Empty renderer (extension
	// blocked) means we cannot prove hardware — default to false.
	const hardwareWebgl =
		d.webglAvailable && d.renderer !== "" && !d.softwareWebGL;

	// rendererString: "no-webgl" sentinel when there is no WebGL context at all,
	// otherwise the actual renderer string (which may be empty when the
	// WEBGL_debug_renderer_info extension is blocked).
	const rendererString = d.webglAvailable ? d.renderer : "no-webgl";

	return {
		hardwareWebgl,
		reducedMotion: d.reducedMotion,
		shouldRenderRichScene: hardwareWebgl && !d.reducedMotion,
		rendererString,
	};
}
