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

const CHANNELS = [
	{
		id: "aws",
		label: "AWS",
		// Most recent AWS channel recording — update when a new notable stream is archived
		fallbackVideoId: "yQNrgpIp1Fs",
	},
	{
		id: "awsonair",
		label: "AWS on Air",
		// Most recent AWS on Air recording — update periodically
		fallbackVideoId: "WUJUvTu2Qjo",
	},
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
	label,
	hostname,
	fallbackVideoId,
	onLiveChange,
}: {
	channelId: string;
	label: string;
	hostname: string;
	fallbackVideoId: string;
	onLiveChange?: (isLive: boolean) => void;
}) {
	const { t } = useTranslation();
	const containerRef = useRef<HTMLDivElement>(null);
	const [offline, setOffline] = useState(false);
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
			// OFFLINE/ONLINE fire on the embed directly — not on getPlayer()
			embed.addEventListener(twitch.Player.OFFLINE, () => {
				setOffline(true);
				setLive(false);
				onLiveChange?.(false);
			});
			embed.addEventListener(twitch.Player.ONLINE, () => {
				setOffline(false);
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
			{/* Twitch embed always visible — SDK shows Twitch's own offline screen when channel is down */}
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
					label={channel.label}
					hostname={hostname}
					fallbackVideoId={channel.fallbackVideoId}
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
