export interface RenderCapability {
	hardwareWebgl: boolean;
	reducedMotion: boolean;
	/** True if we should render the full 3D scene; false if a static fallback should be used */
	shouldRenderRichScene: boolean;
	/** The UNMASKED_RENDERER_WEBGL string, useful for diagnostics */
	rendererString: string;
}

export function detectRenderCapability(): RenderCapability {
	const reducedMotion =
		typeof window !== "undefined"
			? window.matchMedia("(prefers-reduced-motion: reduce)").matches
			: false;

	let hardwareWebgl = false;
	let rendererString = "";

	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas");
		const gl = (canvas.getContext("webgl2") ||
			canvas.getContext("webgl")) as WebGLRenderingContext | null;
		if (gl) {
			const ext = gl.getExtension("WEBGL_debug_renderer_info");
			rendererString = ext
				? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
				: "";
			// Software fallbacks: SwiftShader (Chrome), llvmpipe (Mesa), Microsoft Basic Render Driver (Win)
			hardwareWebgl =
				!!rendererString &&
				!/SwiftShader|llvmpipe|software|Microsoft Basic Render Driver/i.test(
					rendererString,
				);
		} else {
			rendererString = "no-webgl";
		}
		canvas.remove?.();
	}

	return {
		hardwareWebgl,
		reducedMotion,
		shouldRenderRichScene: hardwareWebgl && !reducedMotion,
		rendererString,
	};
}
