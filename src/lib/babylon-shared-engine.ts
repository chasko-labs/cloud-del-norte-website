// Wave 95 — Shared BabylonJS Engine singleton.
//
// Replaces multiple `new Engine()` instances across dune, star-logo,
// atmosphere-ribbon, atmosphere-scene, and babylon-spin-demo with ONE
// engine that renders to multiple registered view canvases. Reduces WebGL
// contexts from 5+ to 1 (excluding fiona-embed which stays separate —
// different bundle, separate BJS instance).
//
// Why a singleton: chrome's WebGL context limit is ~16 (often lower under
// memory pressure). With 5 separate Engine instances plus fiona-embed,
// context exhaustion caused fiona to disappear when stations played long
// enough to push other contexts over the limit. Sharing one engine across
// the main bundle's scenes removes that pressure entirely.
//
// API:
//   - getOrCreateSharedEngine() → Engine, for `new Scene(engine)` calls
//   - registerSceneView(canvas, camera, customRender) — ties a canvas to
//     a custom render function; engine dispatches to it when activeView
//     matches
//   - unregisterSceneView(canvas) — removes view; disposes engine if last
//   - pauseSceneView(canvas) / resumeSceneView(canvas) — freezes a single
//     view without affecting others
//
// Pattern (per consumer):
//   const engine = getOrCreateSharedEngine();
//   const scene = new Scene(engine);
//   const camera = new ArcRotateCamera(..., scene);
//   // ... build meshes, materials, lights ...
//   const customRender = () => {
//     // any per-frame work BEFORE scene.render() goes here (perf timers,
//     // station tint refreshes, etc.)
//     scene.render();
//   };
//   registerSceneView(canvas, camera, customRender);
//
//   // On unmount:
//   scene.dispose();
//   unregisterSceneView(canvas);
//
// Implementation notes:
//   - Working canvas is a 1px hidden offscreen <canvas> appended to body.
//     Engine renders into it; engine.registerView() sets up a copy from
//     working canvas to each visible view canvas via drawImage (handled
//     internally by Babylon's _renderViews()).
//   - Master render loop checks engine.activeView each tick and dispatches
//     to the matching view's customRender. Babylon iterates registered
//     views once per frame and sets activeView for each.
//   - Page Visibility API integration: when document.hidden, stop the
//     engine's render loop; resume when visible. Avoids burn on hidden
//     tabs across all consumers.
//   - All deep imports keep Vite chunking aligned (babylon-engine chunk).
//   - SSR-safe: callers must check typeof document !== 'undefined' first
//     (matches existing pattern in SceneBootstrap).

import "@babylonjs/core/Animations/animatable.js";
import "@babylonjs/core/Engines/AbstractEngine/abstractEngine.views.js";

import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Logger } from "@babylonjs/core/Misc/logger";

// Silence Babylon's INFO-level banner (capability prints, version banner).
// Bit field: WarningLogLevel (2) | ErrorLogLevel (4) = 6.
Logger.LogLevels = Logger.WarningLogLevel | Logger.ErrorLogLevel;

interface RegisteredView {
	customRender: () => void;
	paused: boolean;
}

let _engine: Engine | null = null;
let _workingCanvas: HTMLCanvasElement | null = null;
const _views = new Map<HTMLCanvasElement, RegisteredView>();
// Pending registrations keyed by canvas while we wait for it to gain layout.
// Registering a zero-size canvas causes the engine to render into a 0×0
// framebuffer, producing a flood of GL_INVALID_FRAMEBUFFER_OPERATION errors.
const _deferredObservers = new Map<HTMLCanvasElement, ResizeObserver>();
let _docVisHandlerInstalled = false;

function _masterTick(): void {
	const engine = _engine;
	if (!engine?.activeView) return;
	const target = engine.activeView.target as HTMLCanvasElement;
	const view = _views.get(target);
	if (!view || view.paused) return;
	view.customRender();
}

function _onVisChange(): void {
	if (!_engine) return;
	if (document.hidden) {
		_engine.stopRenderLoop();
	} else {
		_engine.runRenderLoop(_masterTick);
	}
}

function _ensureEngine(): Engine {
	if (_engine) return _engine;

	_workingCanvas = document.createElement("canvas");
	_workingCanvas.width = 1;
	_workingCanvas.height = 1;
	_workingCanvas.style.cssText =
		"position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;visibility:hidden;z-index:-9999";
	_workingCanvas.setAttribute("aria-hidden", "true");
	_workingCanvas.dataset.cdnSharedEngineWorking = "1";
	document.body.appendChild(_workingCanvas);

	try {
		_engine = new Engine(_workingCanvas, true, {
			preserveDrawingBuffer: true,
			stencil: true,
			alpha: true,
		});
	} catch (err) {
		// WebGL unavailable (jsdom test env, very old browser, blocked by
		// extension). Clean up the working canvas and rethrow — callers
		// using try/catch around scene creation can fall back to non-3D paths.
		_workingCanvas.remove();
		_workingCanvas = null;
		throw err;
	}

	_engine.runRenderLoop(_masterTick);

	if (!_docVisHandlerInstalled) {
		document.addEventListener("visibilitychange", _onVisChange);
		_docVisHandlerInstalled = true;
	}

	return _engine;
}

/** Get or lazily create the shared engine. Required for `new Scene(engine)`. */
export function getOrCreateSharedEngine(): Engine {
	return _ensureEngine();
}

/**
 * Register a view canvas with the shared engine. The engine will dispatch
 * to `customRender` whenever its render loop sets `activeView.target` to
 * this canvas. customRender is responsible for calling scene.render()
 * (typically wrapped with any per-frame perf instrumentation).
 */
export function registerSceneView(
	canvas: HTMLCanvasElement,
	camera: Camera,
	customRender: () => void,
): void {
	const engine = _ensureEngine();

	// Defer registration when the canvas has zero dimensions. Common when a
	// parent drawer/panel hasn't opened yet (mobile nav, gated card, etc.).
	// Registering a zero-size view spams GL_INVALID_FRAMEBUFFER_OPERATION on
	// every render-loop tick. Wait for the canvas to gain layout, then
	// register normally. Idempotent: if already deferred or already
	// registered, the second call is a no-op.
	if (_views.has(canvas) || _deferredObservers.has(canvas)) return;
	if (canvas.clientWidth === 0 || canvas.clientHeight === 0) {
		const obs = new ResizeObserver(() => {
			if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
				obs.disconnect();
				_deferredObservers.delete(canvas);
				engine.registerView(canvas, camera);
				_views.set(canvas, { customRender, paused: false });
			}
		});
		obs.observe(canvas);
		_deferredObservers.set(canvas, obs);
		return;
	}

	engine.registerView(canvas, camera);
	_views.set(canvas, { customRender, paused: false });
}

/**
 * Unregister a view. The caller is responsible for disposing its scene
 * BEFORE calling this (so disposal order is: scene.dispose() first, then
 * unregisterSceneView). When the last view is removed, the engine and
 * working canvas are fully disposed.
 */
export function unregisterSceneView(canvas: HTMLCanvasElement): void {
	// Cancel any pending deferred registration for this canvas. Safe to call
	// even when the canvas was never deferred — .get/.delete are no-ops.
	const pendingObs = _deferredObservers.get(canvas);
	if (pendingObs) {
		pendingObs.disconnect();
		_deferredObservers.delete(canvas);
	}

	if (!_engine) return;
	_engine.unRegisterView(canvas);
	_views.delete(canvas);

	if (_views.size === 0) {
		_engine.stopRenderLoop();
		// Explicitly release the WebGL context so Chrome reclaims it
		// immediately rather than waiting for GC. Prevents context-limit
		// pressure across mount/unmount cycles when fiona-embed (separate
		// engine) also wants a context.
		if (_workingCanvas) {
			const gl = (_workingCanvas.getContext("webgl2") ||
				_workingCanvas.getContext("webgl")) as WebGLRenderingContext | null;
			gl?.getExtension("WEBGL_lose_context")?.loseContext?.();
		}
		_engine.dispose();
		_engine = null;
		if (_workingCanvas) {
			_workingCanvas.remove();
			_workingCanvas = null;
		}
		if (_docVisHandlerInstalled) {
			document.removeEventListener("visibilitychange", _onVisChange);
			_docVisHandlerInstalled = false;
		}
	}
}

/** Pause a single view's rendering without affecting others. */
export function pauseSceneView(canvas: HTMLCanvasElement): void {
	const view = _views.get(canvas);
	if (view) view.paused = true;
}

/** Resume a single view's rendering. */
export function resumeSceneView(canvas: HTMLCanvasElement): void {
	const view = _views.get(canvas);
	if (view) view.paused = false;
}

/** For tests / debug only. */
export function _debugGetEngine(): Engine | null {
	return _engine;
}

export function _debugGetViewCount(): number {
	return _views.size;
}
