// Wave 53 — tiny Babylon scene on the wave 52 carousel anchor.
// Lazy-loads @babylonjs/core — never in the main bundle.
// Click to spin. visibilitychange pauses render loop (wave 21 pattern).
//
// Wave 66 — added IntersectionObserver gate + babylon-budget integration.
// Engine is disposed when the carousel scrolls off-screen and re-created on re-entry.
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";
import { useEffect, useRef } from "react";
import { loadBabylonCommon } from "../../lib/babylon-loader";
import {
	getOrCreateSharedEngine,
	registerSceneView,
	unregisterSceneView,
} from "../../lib/babylon-shared-engine";

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
		let _eng: Engine | null = null;
		let ro: ResizeObserver | null = null;
		let io: IntersectionObserver | null = null;

		let currentScene: Scene | null = null;

		function teardown() {
			ro?.disconnect();
			ro = null;
			if (currentScene) {
				currentScene.dispose();
				currentScene = null;
			}
			if (canvas) {
				unregisterSceneView(canvas);
			}
			_eng = null;
		}

		async function startEngine() {
			if (disposed || !canvas) return;
			if (currentScene) return; // already started

			const B = await loadBabylonCommon();
			if (disposed) return;

			const sharedEngine = getOrCreateSharedEngine();
			_eng = sharedEngine;
			const scene = new B.Scene(sharedEngine);
			currentScene = scene;
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

			ro = new ResizeObserver(() => sharedEngine.resize());
			ro.observe(canvas);

			// scene needs an active camera before view registration; the
			// ArcRotateCamera created above is implicitly the activeCamera.
			const cam = scene.activeCamera;
			if (cam) {
				registerSceneView(canvas, cam, render);
			}
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
