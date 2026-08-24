import React from "react";
import type { CrossSiteLock } from "../../lib/meetings";

interface CrossSiteBannerProps {
	lock: CrossSiteLock | null;
	currentSite: string;
}

export function CrossSiteBanner({ lock, currentSite }: CrossSiteBannerProps) {
	if (!lock || lock.site === currentSite) return null;

	const siteName = lock.site === "cdn" ? "Cloud Del Norte" : "NE3D";
	const timeAgo = getTimeAgo(lock.launchedAt);

	return (
		<div
			style={{
				padding: "12px 16px",
				backgroundColor: "#fef3c7",
				border: "1px solid #f59e0b",
				borderRadius: "8px",
				marginBottom: "16px",
				display: "flex",
				alignItems: "center",
				gap: "8px",
			}}
		>
			<span style={{ fontSize: "18px" }}>&#9888;</span>
			<div>
				<strong>Meeting in progress on {siteName}</strong>
				<div style={{ fontSize: "14px", color: "#92400e", marginTop: "2px" }}>
					"{lock.title}" started {timeAgo} — the Jitsi server is occupied
				</div>
			</div>
		</div>
	);
}

function getTimeAgo(isoDate: string): string {
	const diff = Date.now() - new Date(isoDate).getTime();
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ${minutes % 60}m ago`;
}
