// useWallpaperTheme — returns the active CdnWallpaper layer name based on
// the current Cloudscape theme. Subscribes via MutationObserver on <html>
// class so runtime theme toggles propagate without a page reload.
//
// Exposed for consumers who want to read the scene name (analytics, accent-color
// sync, etc.). Used internally by <CdnWallpaper>.
//
// Layer name geography:
//   gypsum-sands  — White Sands NM, light mode
//   el-paso-nights — El Paso TX skyline, dark mode (north of the border)
// Future layers follow the same NM/TX geographic convention:
//   chihuahuan-storm, tularosa-aurora, etc.

import { useEffect, useState } from "react";

export type WallpaperTheme = "gypsum-sands" | "el-paso-nights";

function currentTheme(): WallpaperTheme {
	return document.documentElement.classList.contains("awsui-dark-mode")
		? "el-paso-nights"
		: "gypsum-sands";
}

export function useWallpaperTheme(): WallpaperTheme {
	const [theme, setTheme] = useState<WallpaperTheme>(() =>
		typeof document !== "undefined" ? currentTheme() : "gypsum-sands",
	);

	useEffect(() => {
		const obs = new MutationObserver(() => {
			setTheme(currentTheme());
		});
		obs.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		// Sync on mount in case SSR initial value was wrong
		setTheme(currentTheme());
		return () => obs.disconnect();
	}, []);

	return theme;
}
