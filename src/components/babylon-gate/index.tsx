// Wave 53 — BabylonGate: device-tier gate for all Babylon scenes.
// CSS + skeletons are the bones; Babylon is the accessory.
// Usage: <BabylonGate fallback={<CssPlaceholder />}><HeavyScene /></BabylonGate>

import { type ReactNode, Suspense } from "react";
import { type DeviceTier, getDeviceTier } from "../../lib/device-capabilities";

const TIER_RANK: Record<DeviceTier, number> = { high: 2, medium: 1, low: 0 };

interface Props {
	children: ReactNode;
	fallback: ReactNode;
	/** Minimum tier required to render children. Defaults to 'medium'. */
	tier?: DeviceTier;
}

/**
 * Renders `fallback` when the device tier is below the required `tier`.
 * Wraps children in Suspense so lazy-loaded Babylon components don't block.
 */
export default function BabylonGate({
	children,
	fallback,
	tier = "medium",
}: Props) {
	const deviceTier = getDeviceTier();
	if (TIER_RANK[deviceTier] < TIER_RANK[tier]) {
		return <>{fallback}</>;
	}
	return <Suspense fallback={fallback}>{children}</Suspense>;
}
