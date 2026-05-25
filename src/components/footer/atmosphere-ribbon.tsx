// Wave 60 — AtmosphereRibbon
// Thin strip (32–48px) between page content and docked footer.
// El Paso (America/Denver) time-of-day drives sky gradient + sun/moon disc.
// Babylon scene gated at tier='medium'; CSS-only gradient visible at all tiers.
//
// Wave 66 — added IntersectionObserver gate + babylon-budget integration.
// Wave 70b — fade-in: ribbon starts opacity:0, fades in once loaded.

import { useEffect, useRef, useState } from "react";
import { releaseActivation, requestActivation } from "../../lib/babylon-budget";
import { loadBabylonCommon } from "../../lib/babylon-loader";
import {
	elPasoHour,
	getTOD,
	isNight,
	skyColor,
	sunHourToX,
	todGradient,
} from "../../lib/time-of-day";
import BabylonGate from "../babylon-gate";
import "./atmosphere-ribbon.css";

// ── CSS-only fallback ─────────────────────────────────────────────────────────

function RibbonFallback({ onReady }: { onReady: () => void }) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const apply = () => {
			const h = elPasoHour();
			const tod = getTOD(h);
			ref.current?.style.setProperty("background", todGradient(tod));
		};
		apply();
		// Signal loaded after first paint
		onReady();
		const id = setInterval(apply, 60_000);
		return () => clearInterval(id);
	}, [onReady]);

	return (
		<div
			ref={ref}
			className="cdn-footer-atmosphere-fallback"
			aria-hidden="true"
		/>
	);
}

// ── Babylon scene ─────────────────────────────────────────────────────────────

const SCENE_ID = "atmosphere-ribbon";

function RibbonScene({ hour, onReady }: { hour: number; onReady: () => void }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	// biome-ignore lint/suspicious/noExplicitAny: dynamic babylon import
	const engRef = useRef<any>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		let disposed = false;
		// biome-ignore lint/suspicious/noExplicitAny: dynamic babylon import
		let eng: any = null;
		let ro: ResizeObserver | null = null;
		let io: IntersectionObserver | null = null;

		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		const tod = getTOD(hour);
		const night = isNight(hour);
		const [sr, sg, sb, sa] = skyColor(tod);
		const xNorm = sunHourToX(hour); // 0=left, 1=right

		function teardown() {
			if (eng) {
				eng.stopRenderLoop();
				document.removeEventListener("visibilitychange", eng.__onVis);
				document.body.removeEventListener(
					"cdn-scroll-start",
					eng.__scrollStart,
				);
				document.body.removeEventListener("cdn-scroll-end", eng.__scrollEnd);
				ro?.disconnect();
				ro = null;
				eng.dispose();
				eng = null;
				engRef.current = null;
			}
			releaseActivation(SCENE_ID);
		}

		async function startEngine() {
			if (disposed || !canvas) return;
			if (!requestActivation(SCENE_ID)) return;

			const B = await loadBabylonCommon();
			if (disposed) {
				releaseActivation(SCENE_ID);
				return;
			}

			eng = new B.Engine(canvas, true, { preserveDrawingBuffer: false });
			engRef.current = eng;
			const scene = new B.Scene(eng);
			scene.clearColor = new B.Color4(sr, sg, sb, sa);

			// Orthographic camera — no user input, fills the ribbon exactly
			const cam = new B.ArcRotateCamera(
				"cam",
				-Math.PI / 2,
				Math.PI / 2,
				10,
				B.Vector3.Zero(),
				scene,
			);
			cam.inputs.clear();
			cam.mode = 1; // ORTHOGRAPHIC_CAMERA
			cam.orthoLeft = -1;
			cam.orthoRight = 1;
			cam.orthoBottom = -0.25;
			cam.orthoTop = 0.25;

			// No lights needed — unlit emissive disc only
			scene.ambientColor = new B.Color3(1, 1, 1);

			// Sun/moon disc — positioned horizontally by sunHourToX
			// X maps: 0 → -1 (left), 1 → +1 (right)
			const discX = xNorm * 2 - 1;
			const disc = B.MeshBuilder.CreateDisc(
				"disc",
				{ radius: 0.18, tessellation: 32 },
				scene,
			);
			disc.position = new B.Vector3(discX, 0, 0);
			disc.rotation.x = Math.PI / 2;

			const mat = new B.StandardMaterial("disc-mat", scene);
			mat.emissiveColor = night
				? new B.Color3(0.85, 0.88, 1.0) // cool white moon
				: new B.Color3(1.0, 0.92, 0.35); // warm yellow sun
			mat.disableLighting = true;
			disc.material = mat;

			// Gentle breathing on disc (non-reduced only)
			if (!reduced) {
				const anim = new B.Animation(
					"breathe",
					"scaling",
					30,
					B.Animation.ANIMATIONTYPE_VECTOR3,
					B.Animation.ANIMATIONLOOPMODE_CYCLE,
				);
				anim.setKeys([
					{ frame: 0, value: new B.Vector3(1, 1, 1) },
					{ frame: 60, value: new B.Vector3(1.07, 1.07, 1) },
					{ frame: 120, value: new B.Vector3(1, 1, 1) },
				]);
				disc.animations = [anim];
				scene.beginAnimation(disc, 0, 120, true);
			}

			const render = () => scene.render();

			const onVis = () =>
				document.hidden ? eng.stopRenderLoop() : eng.runRenderLoop(render);
			document.addEventListener("visibilitychange", onVis);
			eng.__onVis = onVis;

			const onScrollStart = () => eng.stopRenderLoop();
			const onScrollEnd = () => eng.runRenderLoop(render);
			document.body.addEventListener("cdn-scroll-start", onScrollStart);
			document.body.addEventListener("cdn-scroll-end", onScrollEnd);
			eng.__scrollStart = onScrollStart;
			eng.__scrollEnd = onScrollEnd;

			ro = new ResizeObserver(() => eng.resize());
			ro.observe(canvas);
			eng.__ro = ro;

			if (reduced) {
				scene.render();
			} else {
				eng.runRenderLoop(render);
			}

			// Wave 70b — signal loaded after first render loop starts
			onReady();
		}

		// IntersectionObserver: only run when ribbon is on-screen
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
		// hour-driven palette changes on mount only — ribbon re-reads hour each minute via parent
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [hour, onReady]);

	return (
		// biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative, non-interactive
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			style={{
				display: "block",
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
}

// ── Public component ──────────────────────────────────────────────────────────

export default function AtmosphereRibbon() {
	const [hour, setHour] = useState(() => elPasoHour());
	const ribbonRef = useRef<HTMLDivElement>(null);

	// Refresh hour once per minute so the gradient + disc position track real time
	useEffect(() => {
		const id = setInterval(() => setHour(elPasoHour()), 60_000);
		return () => clearInterval(id);
	}, []);

	const handleReady = useRef(() => {
		ribbonRef.current?.classList.add("is-loaded");
	}).current;

	return (
		<div
			ref={ribbonRef}
			className="cdn-atmosphere-ribbon"
			aria-hidden="true"
			data-testid="atmosphere-ribbon"
		>
			<BabylonGate
				tier="medium"
				fallback={<RibbonFallback onReady={handleReady} />}
			>
				<RibbonScene hour={hour} onReady={handleReady} />
			</BabylonGate>
		</div>
	);
}
