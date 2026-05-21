/**
 * Auth subdomain background atmosphere.
 * Mounts a minimal Babylon sky scene behind the auth card.
 * Self-gated: software renderer or reduced-motion → canvas never mounts.
 */

let disposeAtmosphere: (() => void) | null = null;

function isSoftwareRenderer(): boolean {
	try {
		const canvas = document.createElement("canvas");
		const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
		if (!gl) return true;
		const dbgInfo = gl.getExtension("WEBGL_debug_renderer_info");
		if (!dbgInfo) return false;
		const renderer = gl
			.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)
			.toString()
			.toLowerCase();
		return /swiftshader|llvmpipe|softpipe|microsoft basic/.test(renderer);
	} catch {
		return true;
	}
}

export function mountAuthAtmosphere(container: HTMLElement): void {
	if (typeof window === "undefined") return;
	if (isSoftwareRenderer()) return;
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const canvas = document.createElement("canvas");
	canvas.setAttribute("data-cdn-dune-canvas", "1");
	canvas.setAttribute("aria-hidden", "true");
	container.appendChild(canvas);

	let disposed = false;

	void import("@babylonjs/core").then(
		({ Engine, Scene, Color4, HemisphericLight, Vector3, Color3 }) => {
			if (disposed) return;

			const engine = new Engine(canvas, true, {
				adaptToDeviceRatio: false,
				preserveDrawingBuffer: false,
			});

			const scene = new Scene(engine);
			scene.clearColor = new Color4(0, 0, 0, 0);

			// Ambient light only — no meshes, no shadows
			const light = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
			light.diffuse = new Color3(0.85, 0.8, 1.0);
			light.intensity = 0.6;

			// Perf gate: if median frame time > 20ms after 3s warmup, dispose
			const frameTimes: number[] = [];
			const warmupMs = 3000;
			const warmupStart = performance.now();
			let gateChecked = false;

			engine.runRenderLoop(() => {
				const now = performance.now();
				if (!gateChecked && now - warmupStart > warmupMs) {
					const median =
						frameTimes.sort((a, b) => a - b)[
							Math.floor(frameTimes.length / 2)
						] ?? 0;
					if (median > 20) {
						cleanup();
						return;
					}
					gateChecked = true;
				}
				if (frameTimes.length < 60) frameTimes.push(engine.getDeltaTime());
				scene.render();
			});

			const handleResize = () => engine.resize();
			window.addEventListener("resize", handleResize);

			function cleanup() {
				disposed = true;
				engine.stopRenderLoop();
				scene.dispose();
				engine.dispose();
				window.removeEventListener("resize", handleResize);
				canvas.remove();
			}

			disposeAtmosphere = cleanup;
		},
	);
}

export function unmountAuthAtmosphere(): void {
	disposeAtmosphere?.();
	disposeAtmosphere = null;
}
