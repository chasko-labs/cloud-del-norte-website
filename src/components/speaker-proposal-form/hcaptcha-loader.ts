declare global {
  interface Window {
    hcaptcha: {
      render: (container: string | HTMLElement, params: { sitekey: string }) => string;
      getResponse: (widgetId?: string) => string;
      reset: (widgetId?: string) => void;
    };
    onHCaptchaLoad: () => void;
  }
}

let loadPromise: Promise<void> | null = null;
let widgetId: string | null = null;

export function loadHCaptcha(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    if (typeof window.hcaptcha !== "undefined") {
      resolve();
      return;
    }
    window.onHCaptchaLoad = () => resolve();
    const script = document.createElement("script");
    script.src =
      "https://hcaptcha.com/1/api.js?onload=onHCaptchaLoad&render=explicit";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function renderHCaptcha(containerId: string): Promise<void> {
  await loadHCaptcha();
  const el = document.getElementById(containerId);
  if (!el || el.childElementCount > 0) return;
  widgetId = window.hcaptcha.render(el, {
    sitekey: import.meta.env.VITE_HCAPTCHA_SITE_KEY as string,
  });
}

export function getHCaptchaResponse(): string {
  return widgetId !== null
    ? window.hcaptcha.getResponse(widgetId)
    : window.hcaptcha?.getResponse() ?? "";
}

export function resetHCaptcha(): void {
  if (typeof window.hcaptcha !== "undefined") {
    widgetId !== null
      ? window.hcaptcha.reset(widgetId)
      : window.hcaptcha.reset();
  }
  // allow re-render on next mount
  widgetId = null;
}
