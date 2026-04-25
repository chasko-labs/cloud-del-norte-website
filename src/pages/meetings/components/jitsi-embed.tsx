import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import React, { useEffect, useRef, useState } from "react";
import { BannedUserError, fetchJitsiToken } from "../../../lib/jitsi-token";

export interface JitsiEmbedProps {
	roomName: string;
	onClose?: () => void;
}

// Window global exposed by external_api.js once loaded.
declare global {
	interface Window {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

type Status = "loading" | "connecting" | "live" | "error";

export default function JitsiEmbed({ roomName, onClose }: JitsiEmbedProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const apiRef = useRef<any>(null);
	const [status, setStatus] = useState<Status>("loading");
	const [errorMsg, setErrorMsg] = useState<string>("");

	useEffect(() => {
		let cancelled = false;

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
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
					},
					interfaceConfigOverwrite: {
						SHOW_JITSI_WATERMARK: false,
						SHOW_BRAND_WATERMARK: false,
					},
				});

				api.addListener("videoConferenceJoined", () => {
					if (!cancelled) setStatus("live");
				});
				api.addListener("readyToClose", () => {
					if (!cancelled) onClose?.();
				});

				apiRef.current = api;
			} catch (err) {
				if (cancelled) return;
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
			try {
				apiRef.current?.dispose?.();
			} catch {
				// swallow — component unmounting, best-effort cleanup
			}
			apiRef.current = null;
		};
	}, [roomName, onClose]);

	if (status === "error") {
		return (
			<Alert type="error" header="cannot join meeting">
				{errorMsg}
			</Alert>
		);
	}

	return (
		<Box>
			{status !== "live" && (
				<Box padding={{ vertical: "m" }} textAlign="center">
					<SpaceBetween size="s" alignItems="center">
						<Spinner size="large" />
						<Box variant="p">
							{status === "loading"
								? "requesting access token…"
								: "connecting to meeting…"}
						</Box>
					</SpaceBetween>
				</Box>
			)}
			<div ref={hostRef} data-testid="jitsi-iframe-host" />
		</Box>
	);
}
