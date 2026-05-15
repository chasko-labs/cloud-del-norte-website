declare global {
  interface Window {
    AwsWafIntegration: {
      getToken: () => Promise<string>;
    };
    AwsWafCaptcha: {
      renderCaptcha: (
        container: HTMLElement,
        options: {
          apiKey?: string;
          onSuccess: (token: string) => void;
          onError: (error: unknown) => void;
          onErrorReturn?: (error: unknown) => void;
        },
      ) => void;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

export function ensureSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (typeof window.AwsWafIntegration !== "undefined") {
      resolve();
      return;
    }
    const integrationUrl = import.meta.env.VITE_WAF_INTEGRATION_URL as string;
    const script = document.createElement("script");
    script.defer = true;
    script.src = `${integrationUrl}jsapi.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("WAF SDK load failed"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function getToken(): Promise<string> {
  return window.AwsWafIntegration.getToken();
}

export function renderCaptcha(
  container: HTMLElement,
  callbacks: { onSuccess: (token: string) => void; onError: (error: unknown) => void },
): void {
  window.AwsWafCaptcha.renderCaptcha(container, {
    onSuccess: callbacks.onSuccess,
    onError: callbacks.onError,
    onErrorReturn: callbacks.onError,
  });
}
