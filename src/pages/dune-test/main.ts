// dune-test — standalone validation page for the white-sands gypsum-dune wallpaper
// PR #1 of light-mode background replacement. Not yet wired into background-viz.

import { mountDuneScene } from "./scene";

const canvas = document.getElementById("dune-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
	throw new Error("dune-test: #dune-canvas not found or wrong element type");
}

const handle = mountDuneScene(canvas);

window.addEventListener("resize", () => handle.resize());
window.addEventListener("beforeunload", () => handle.dispose());
