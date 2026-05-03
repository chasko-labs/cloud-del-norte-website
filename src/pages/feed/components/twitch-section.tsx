// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";

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

// Note on offline behavior + IVS 404 console errors:
//
// When a twitch channel is offline, the embed SDK still attempts to load the
// IVS HLS master playlist before resolving to its built-in offline UI. That
// probe surfaces in the console as:
//   `Player stopping playback - error MasterPlaylist:11
//    (ErrorNotAvailable code 404 - Failed to load playlist)`
//
// Eliminating the 404 cleanly requires the Twitch Helix API: check
// /helix/streams?user_login=<channel> for live state, and on offline call
// /helix/videos?user_id=<id>&first=1&type=archive to swap in the most recent
// VOD. Helix needs a Bearer token from a Twitch app client_id+secret pair.
// This project has NO twitch credentials configured (.env.production /
// .env.local both empty of TWITCH_*), so we fall back to embedding the
// channel directly per the documented graceful-degradation path. Twitch's
// own player UI surfaces a "channel offline — see recent broadcasts" panel
// once the IVS probe resolves; we accept the one-time 404 as the cost of
// not running a credentialed integration.
//
// To upgrade later: add VITE_TWITCH_CLIENT_ID + a server-side token-mint
// endpoint, then call helix from a useEffect that gates whether to mount
// the embed with `channel:` (live) vs `video:` (most recent VOD).
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
}: {
	channelId: string;
	hostname: string;
	onLiveChange?: (isLive: boolean) => void;
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
			});
			embed.addEventListener(twitch.Player.ONLINE, () => {
				setLive(true);
				onLiveChange?.(true);
			});
		});
	}, [channelId, hostname, onLiveChange]);

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
			{/* Twitch embed always visible — SDK shows Twitch's own offline screen
			    (with recent-broadcasts navigation) when the channel is down. */}
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
}: {
	channel: (typeof CHANNELS)[number];
	onLiveChange?: (isLive: boolean) => void;
}) {
	const { t } = useTranslation();
	const hostname = useHostname();
	return (
		<Container>
			{hostname ? (
				<TwitchChannelEmbed
					channelId={channel.id}
					hostname={hostname}
					onLiveChange={onLiveChange}
				/>
			) : (
				<p className="feed-twitch__fallback">
					<a
						href={`https://www.twitch.tv/${channel.id}`}
						target="_blank"
						rel="noopener noreferrer"
					>
						{t("feedPage.twitchWatchOn")} — {channel.label}
					</a>
				</p>
			)}
		</Container>
	);
}

export function TwitchAws({
	onLiveChange,
}: {
	onLiveChange?: (isLive: boolean) => void;
} = {}) {
	return (
		<TwitchChannelCard channel={CHANNELS[0]} onLiveChange={onLiveChange} />
	);
}

export function TwitchAwsOnAir({
	onLiveChange,
}: {
	onLiveChange?: (isLive: boolean) => void;
} = {}) {
	return (
		<TwitchChannelCard channel={CHANNELS[1]} onLiveChange={onLiveChange} />
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
