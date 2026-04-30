import { createAudioBridge, resumeCtx } from "./audio.js";
import { initCanvas } from "./canvas.js";

let mounted = false;

export function mount(): () => void {
  if (mounted) return () => {};
  mounted = true;

  const { canvas, ctx, startLoop, stopLoop, resize } = initCanvas();
  const { initAudio, destroyAudio } = createAudioBridge(ctx);

  function onPlay(e: Event): void {
    const { element, stationKey } = (e as CustomEvent).detail as {
      element: HTMLAudioElement;
      stationKey: string;
    };
    initAudio(element, stationKey);
    startLoop();
  }

  function onStop(): void {
    stopLoop();
  }

  window.addEventListener("cdn:audio:play", onPlay);
  window.addEventListener("cdn:audio:stop", onStop);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    resumeCtx();
  });

  return function destroy(): void {
    mounted = false;
    stopLoop();
    destroyAudio();
    window.removeEventListener("cdn:audio:play", onPlay);
    window.removeEventListener("cdn:audio:stop", onStop);
    window.removeEventListener("resize", resize);
    canvas.remove();
  };
}
