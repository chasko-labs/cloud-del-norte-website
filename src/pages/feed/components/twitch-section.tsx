// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import { probeTwitchLive } from "../../../lib/twitch-channel-cache";

// Twitch Embed SDK types (loaded via script tag at runtime)
interface TwitchEmbed {
	addEventListener(event: string, callback: () => void): void;
}
interface TwitchEmbedConstructor {
	new (el: HTMLElement, opts: Record<string, unknown>): TwitchEmbed;
}
interface TwitchStatic {
	Embed: TwitchEmbedConstructor;
	Player: { OFFLINE: string; ONLINE: string };
}

declare global {
	interface Window {
		Twitch?: TwitchStatic;
	}
}

// Offline behavior:
//
// Bryan rejects the default Twitch embed offline UI ("AWS is offline — visit
// AWS"). We hide the entire card when the channel is not currently live.
//
// Detection runs in two layers:
//   1. Upfront probe via gql.twitch.tv UseLive (unauthenticated public client
//      id, same call the official twitch.tv bundle uses to render the green
//      LIVE dot). Cached per-session via twitch-channel-cache. When this
//      returns { live: false } we never mount the embed at all → no flash, no
//      404 console noise from the IVS playlist probe.
//   2. Reactive fallback via the Embed SDK's OFFLINE event. This catches the
//      case where the upfront probe returned null (transient failure: 5xx,
//      network drop, malformed payload) so we still mount-then-hide rather
//      than show the offline CTA forever.
//
// Live discovery surfaces upward via the existing onLiveChange callback
// (hero-promotion in feed/app.tsx). Offline discovery surfaces upward via the
// new onOfflineChange callback so the parent can drop the empty grid cell.
const CHANNELS = [
	{ id: "aws", label: "AWS" },
	{ id: "awsonair", label: "AWS on Air" },
];

let twitchScriptLoading = false;
const twitchReadyCallbacks: Array<() => void> = [];

function loadTwitchSDK(onReady: () => void) {
	if (window.Twitch) {
		onReady();
		return;
	}
	twitchReadyCallbacks.push(onReady);
	if (twitchScriptLoading) return;
	twitchScriptLoading = true;
	const script = document.createElement("script");
	script.src = "https://embed.twitch.tv/embed/v1.js";
	script.async = true;
	script.onload = () => {
		twitchScriptLoading = false;
		twitchReadyCallbacks.splice(0).forEach((cb) => cb());
	};
	document.head.appendChild(script);
}

function TwitchChannelEmbed({
	channelId,
	hostname,
	onLiveChange,
	onOfflineChange,
}: {
	channelId: string;
	hostname: string;
	onLiveChange?: (isLive: boolean) => void;
	onOfflineChange?: (isOffline: boolean) => void;
}) {
	const { t } = useTranslation();
	const containerRef = useRef<HTMLDivElement>(null);
	const [live, setLive] = useState(false);

	useEffect(() => {
		if (!containerRef.current) return;
		const el = containerRef.current;

		loadTwitchSDK(() => {
			const twitch = window.Twitch;
			if (!twitch || !el) return;
			const embed = new twitch.Embed(el, {
				width: "100%",
				height: 300,
				channel: channelId,
				parent: [hostname],
				autoplay: false,
				layout: "video",
			});
			// OFFLINE/ONLINE fire on the embed directly — not on getPlayer().
			embed.addEventListener(twitch.Player.OFFLINE, () => {
				setLive(false);
				onLiveChange?.(false);
				// reactive hide path: probe was null/transient and SDK confirms offline
				onOfflineChange?.(true);
			});
			embed.addEventListener(twitch.Player.ONLINE, () => {
				setLive(true);
				onLiveChange?.(true);
				onOfflineChange?.(false);
			});
		});
	}, [channelId, hostname, onLiveChange, onOfflineChange]);

	return (
		<div className="feed-twitch__channel">
			{live && (
				<span className="feed-twitch__label">
					<span className="feed-twitch__live-dot" aria-hidden="true" />
					<span className="feed-twitch__live-label">
						{t("feedPage.twitchLive")}
					</span>
				</span>
			)}
			<div ref={containerRef} style={{ width: "100%", height: 300 }} />
		</div>
	);
}

function useHostname(): string | null {
	const [hostname, setHostname] = useState<string | null>(null);
	useEffect(() => {
		setHostname(window.location.hostname);
	}, []);
	return hostname;
}

function TwitchChannelCard({
	channel,
	onLiveChange,
	onOfflineChange,
}: {
	channel: (typeof CHANNELS)[number];
	onLiveChange?: (isLive: boolean) => void;
	onOfflineChange?: (isOffline: boolean) => void;
}) {
	const hostname = useHostname();
	// upfront probe — null = unknown/transient (mount embed, rely on SDK event),
	// true = live (mount), false = offline (skip mount entirely, signal up).
	const [probeLive, setProbeLive] = useState<boolean | null>(null);

	useEffect(() => {
		let cancelled = false;
		probeTwitchLive(channel.id).then((result) => {
			if (cancelled) return;
			if (result === null) {
				// transient failure — leave probeLive null so embed mounts and
				// SDK OFFLINE/ONLINE events take over
				setProbeLive(null);
				return;
			}
			setProbeLive(result.live);
			if (!result.live) onOfflineChange?.(true);
			else onLiveChange?.(true);
		});
		return () => {
			cancelled = true;
		};
	}, [channel.id, onLiveChange, onOfflineChange]);

	// confirmed offline by upfront probe → render nothing (parent hides cell)
	if (probeLive === false) return null;

	if (!hostname) {
		// SSR / pre-hydration — no embed, no fallback CTA (Bryan rejects it)
		return null;
	}

	return (
		<Container>
			<TwitchChannelEmbed
				channelId={channel.id}
				hostname={hostname}
				onLiveChange={onLiveChange}
				onOfflineChange={onOfflineChange}
			/>
		</Container>
	);
}

export function TwitchAws({
	onLiveChange,
	onOfflineChange,
}: {
	onLiveChange?: (isLive: boolean) => void;
	onOfflineChange?: (isOffline: boolean) => void;
} = {}) {
	return (
		<TwitchChannelCard
			channel={CHANNELS[0]}
			onLiveChange={onLiveChange}
			onOfflineChange={onOfflineChange}
		/>
	);
}

export function TwitchAwsOnAir({
	onLiveChange,
	onOfflineChange,
}: {
	onLiveChange?: (isLive: boolean) => void;
	onOfflineChange?: (isOffline: boolean) => void;
} = {}) {
	return (
		<TwitchChannelCard
			channel={CHANNELS[1]}
			onLiveChange={onLiveChange}
			onOfflineChange={onOfflineChange}
		/>
	);
}

// backward-compat default kept in case old imports remain
export default function TwitchSection() {
	return (
		<>
			<TwitchAws />
			<TwitchAwsOnAir />
		</>
	);
}
