import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useRef, useState } from "react";
import { BannedUserError, fetchJitsiToken } from "../../../lib/jitsi-token";

export interface JitsiEmbedProps {
	roomName: string;
	onClose?: () => void;
}

// Window global exposed by external_api.js once loaded.
declare global {
	interface Window {
		JitsiMeetExternalAPI?: any;
	}
}

// Loads the jitsi external_api.js script once per page and resolves when ready.
function loadJitsiScript(domain: string): Promise<void> {
	if (typeof window === "undefined")
		return Promise.reject(new Error("no window"));
	if (window.JitsiMeetExternalAPI) return Promise.resolve();

	const existing = document.querySelector<HTMLScriptElement>(
		'script[data-cdn-jitsi="1"]',
	);
	if (existing) {
		return new Promise((resolve, reject) => {
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener(
				"error",
				() => reject(new Error("jitsi script failed to load")),
				{
					once: true,
				},
			);
		});
	}

	return new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = `https://${domain}/external_api.js`;
		script.async = true;
		script.setAttribute("data-cdn-jitsi", "1");
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("jitsi script failed to load"));
		document.head.appendChild(script);
	});
}

type Status =
	| "loading"
	| "connecting"
	| "cold-start"
	| "live"
	| "error"
	| "unreachable";

// Detect locale from <html lang> attribute; fall back to en-US.
function getLocale(): "en-US" | "es-MX" {
	return document.documentElement.lang === "es-MX" ? "es-MX" : "en-US";
}

const COPY = {
	"en-US": {
		coldStart: "Meeting room is starting up, please wait…",
		unreachableHeader: "Unable to connect",
		unreachableBody: "The meeting room may be unavailable.",
		retryButton: "Retry",
		permBlockedHeader: "Camera or microphone access blocked",
		permBlockedBody:
			"Click the lock icon in your browser's address bar to allow access, then refresh.",
	},
	"es-MX": {
		coldStart: "La sala se está iniciando, por favor espere…",
		unreachableHeader: "No se puede conectar",
		unreachableBody: "La sala de reuniones puede no estar disponible.",
		retryButton: "Reintentar",
		permBlockedHeader: "Acceso a cámara o micrófono bloqueado",
		permBlockedBody:
			"Haga clic en el icono de candado en la barra de direcciones para permitir acceso, luego actualice.",
	},
} as const;

const COLD_START_MS = 5_000;
const UNREACHABLE_MS = 90_000;

export default function JitsiEmbed({ roomName, onClose }: JitsiEmbedProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const apiRef = useRef<any>(null);
	const [status, setStatus] = useState<Status>("loading");
	const [errorMsg, setErrorMsg] = useState<string>("");
	const [retryKey, setRetryKey] = useState(0);
	const [permBlocked, setPermBlocked] = useState(false);

	const locale = getLocale();
	const t = COPY[locale];

	// FP-012: detect denied camera/mic permissions on mount; graceful no-op if API unavailable
	useEffect(() => {
		if (!navigator.permissions) return;
		Promise.all([
			navigator.permissions.query({ name: "camera" as PermissionName }),
			navigator.permissions.query({ name: "microphone" as PermissionName }),
		])
			.then(([cam, mic]) => {
				if (cam.state === "denied" || mic.state === "denied")
					setPermBlocked(true);
			})
			.catch(() => {
				// Safari may throw — do nothing
			});
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: retryKey is an intentional re-run trigger
	useEffect(() => {
		let cancelled = false;
		let coldTimer: ReturnType<typeof setTimeout> | null = null;
		let unreachableTimer: ReturnType<typeof setTimeout> | null = null;

		const clearTimers = () => {
			if (coldTimer !== null) clearTimeout(coldTimer);
			if (unreachableTimer !== null) clearTimeout(unreachableTimer);
		};

		(async () => {
			try {
				setStatus("loading");
				const { token, domain } = await fetchJitsiToken();
				if (cancelled) return;

				await loadJitsiScript(domain);
				if (cancelled) return;
				if (!window.JitsiMeetExternalAPI)
					throw new Error("JitsiMeetExternalAPI unavailable");
				if (!hostRef.current) throw new Error("embed host node missing");

				setStatus("connecting");

				// FP-009: after 5s without videoConferenceJoined, show cold-start message
				coldTimer = setTimeout(() => {
					if (!cancelled) setStatus("cold-start");
				}, COLD_START_MS);

				// FP-013: after 90s without videoConferenceJoined, surface unreachable error
				unreachableTimer = setTimeout(() => {
					if (!cancelled) setStatus("unreachable");
				}, UNREACHABLE_MS);

				const api: any = new window.JitsiMeetExternalAPI(domain, {
					roomName,
					jwt: token,
					parentNode: hostRef.current,
					width: "100%",
					height: 640,
					configOverwrite: {
						prejoinPageEnabled: true,
						startWithAudioMuted: true,
						startWithVideoMuted: true,
						dynamicBrandingUrl: "",
						brandingRoomAlias: "",
						localRecording: {
							enabled: true,
							format: "webm",
						},
					},
					interfaceConfigOverwrite: {
						SHOW_JITSI_WATERMARK: false,
						SHOW_BRAND_WATERMARK: false,
						APP_NAME: "Cloud Del Norte",
						DEFAULT_LOGO_URL: "https://clouddelnorte.org/brand/logo.svg",
						DEFAULT_WELCOME_PAGE_LOGO_URL:
							"https://clouddelnorte.org/brand/logo.svg",
						JITSI_WATERMARK_LINK: "https://clouddelnorte.org",
						NATIVE_APP_NAME: "Cloud Del Norte",
						PROVIDER_NAME: "Cloud Del Norte AWS User Group",
						TOOLBAR_BUTTONS: [
							"camera",
							"chat",
							"closedcaptions",
							"desktop",
							"filmstrip",
							"fullscreen",
							"hangup",
							"microphone",
							"participants-pane",
							"raisehand",
							"recording",
							"select-background",
							"settings",
							"tileview",
							"toggle-camera",
						],
					},
				});

				api.addListener("videoConferenceJoined", () => {
					if (!cancelled) {
						clearTimers();
						setStatus("live");
					}
				});
				api.addListener("readyToClose", () => {
					if (!cancelled) onClose?.();
				});

				apiRef.current = api;
			} catch (err) {
				if (cancelled) return;
				clearTimers();
				if (err instanceof BannedUserError) {
					setErrorMsg("your account is banned from meetings.");
				} else {
					setErrorMsg(
						err instanceof Error ? err.message : "failed to start meeting",
					);
				}
				setStatus("error");
			}
		})();

		return () => {
			cancelled = true;
			clearTimers();
			try {
				apiRef.current?.dispose?.();
			} catch {
				// swallow — component unmounting, best-effort cleanup
			}
			apiRef.current = null;
		};
	}, [roomName, onClose, retryKey]);

	if (status === "error") {
		return (
			<Alert type="error" header="cannot join meeting">
				{errorMsg}
			</Alert>
		);
	}

	if (status === "unreachable") {
		return (
			<Alert
				type="error"
				statusIconAriaLabel="Error"
				header={t.unreachableHeader}
				action={
					<Button onClick={() => setRetryKey((k) => k + 1)}>
						{t.retryButton}
					</Button>
				}
			>
				{t.unreachableBody}
			</Alert>
		);
	}

	return (
		<Box>
			{(status === "connecting" || status === "cold-start") && (
				<Box padding={{ vertical: "m" }} textAlign="center">
					<SpaceBetween size="s" alignItems="center">
						<Spinner size="large" />
						{status === "cold-start" ? (
							<Alert type="info" statusIconAriaLabel="Info">
								{t.coldStart}
							</Alert>
						) : (
							<Box variant="p">connecting to meeting…</Box>
						)}
					</SpaceBetween>
				</Box>
			)}
			{status === "loading" && (
				<Box padding={{ vertical: "m" }} textAlign="center">
					<SpaceBetween size="s" alignItems="center">
						<Spinner size="large" />
						<Box variant="p">requesting access token…</Box>
					</SpaceBetween>
				</Box>
			)}
			{permBlocked && (
				<Alert
					type="warning"
					statusIconAriaLabel="Warning"
					header={t.permBlockedHeader}
				>
					{t.permBlockedBody}
				</Alert>
			)}
			<div ref={hostRef} data-testid="jitsi-iframe-host" />
		</Box>
	);
}
