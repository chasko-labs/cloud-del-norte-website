// Wave 66 — tracks whether the Cloudscape navigation drawer is open.
// The shell's handleNavigationChange dispatches cdn-nav-open/cdn-nav-close events
// when the panel opens/closes. Components inside Navigation can listen for these
// to conditionally mount expensive children (e.g. FionaFrame).
//
// SSR-safe: defaults to false so FionaFrame never mounts during initial render
// on a closed panel, saving a WebGL context on every page load.

import { useEffect, useState } from "react";

export const CDN_NAV_OPEN_EVENT = "cdn-nav-open";
export const CDN_NAV_CLOSE_EVENT = "cdn-nav-close";

/** Dispatches the appropriate nav-state event. Called by the shell after state change. */
export function dispatchNavState(open: boolean): void {
	document.dispatchEvent(
		new CustomEvent(open ? CDN_NAV_OPEN_EVENT : CDN_NAV_CLOSE_EVENT),
	);
}

/** Returns true when the navigation drawer is open. Defaults to false. */
export function usePanelOpen(): boolean {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		const onOpen = () => setOpen(true);
		const onClose = () => setOpen(false);
		document.addEventListener(CDN_NAV_OPEN_EVENT, onOpen);
		document.addEventListener(CDN_NAV_CLOSE_EVENT, onClose);
		return () => {
			document.removeEventListener(CDN_NAV_OPEN_EVENT, onOpen);
			document.removeEventListener(CDN_NAV_CLOSE_EVENT, onClose);
		};
	}, []);

	return open;
}
