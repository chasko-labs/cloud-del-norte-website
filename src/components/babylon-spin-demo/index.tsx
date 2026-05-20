// Wave 53 — tiny Babylon scene on the wave 52 carousel anchor.
// Lazy-loads @babylonjs/core — never in the main bundle.
// Click to spin. visibilitychange pauses render loop (wave 21 pattern).
//
// Wave 66 — added IntersectionObserver gate + babylon-budget integration.
// Engine is disposed when the carousel scrolls off-screen and re-created on re-entry.
import { useEffect, useRef } from "react";
import {
	releaseActivation,
	requestActivation,
} from "../../lib/babylon-budget";

const SCENE_ID = "babylon-spin-demo";

export default function BabylonSpinDemo({
	thumbnailUrl,
}: {
	thumbnailUrl: string;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let disposed = false;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic babylon import
		let eng: any = null;
		let ro: ResizeObserver | null = null;
		let io: IntersectionObserver | null = null;

		function teardown() {
			if (eng) {
				eng.stopRenderLoop();
				document.removeEventListener("visibilitychange", eng.__onVis);
				ro?.disconnect();
				ro = null;
				eng.dispose();
				eng = null;
			}
			releaseActivation(SCENE_ID);
		}

		async function startEngine() {
			if (disposed || !canvas) return;
			if (!requestActivation(SCENE_ID)) return;

			const B = await import("@babylonjs/core");
			if (disposed) {
				releaseActivation(SCENE_ID);
				return;
			}

			eng = new B.Engine(canvas, true, { preserveDrawingBuffer: false });
			const scene = new B.Scene(eng);
			scene.clearColor = new B.Color4(0, 0, 0, 0);
			new B.ArcRotateCamera(
				"cam",
				-Math.PI / 2,
				Math.PI / 2,
				3,
				B.Vector3.Zero(),
				scene,
			);
			new B.HemisphericLight("light", new B.Vector3(0, 1, 0), scene);
			const plane = B.MeshBuilder.CreatePlane("plane", { size: 1.6 }, scene);
			const mat = new B.StandardMaterial("mat", scene);
			mat.diffuseTexture = new B.Texture(thumbnailUrl, scene);
			mat.emissiveColor = B.Color3.White();
			plane.material = mat;
			canvas.addEventListener("click", () => {
				B.Animation.CreateAndStartAnimation(
					"spin",
					plane,
					"rotation.y",
					30,
					30,
					plane.rotation.y,
					plane.rotation.y + Math.PI * 2,
					B.Animation.ANIMATIONLOOPMODE_CONSTANT,
				);
			});
			const render = () => scene.render();
			const onVis = () =>
				document.hidden ? eng.stopRenderLoop() : eng.runRenderLoop(render);
			document.addEventListener("visibilitychange", onVis);
			eng.__onVis = onVis;

			ro = new ResizeObserver(() => eng.resize());
			ro.observe(canvas);

			eng.runRenderLoop(render);
		}

		// IntersectionObserver: only run when carousel is on-screen
		io = new IntersectionObserver(
			(entries) => {
				const intersecting = entries[0]?.isIntersecting ?? false;
				if (intersecting) {
					void startEngine();
				} else {
					teardown();
				}
			},
			{ threshold: 0.1 },
		);
		io.observe(canvas);

		return () => {
			disposed = true;
			io?.disconnect();
			io = null;
			teardown();
		};
	}, [thumbnailUrl]);

	return (
		<div
			style={{ width: "100%", aspectRatio: "16/9", background: "transparent" }}
		>
			<canvas
				ref={canvasRef}
				style={{ width: "100%", height: "100%", display: "block" }}
				aria-label="Spinning video preview"
			/>
		</div>
	);
}
