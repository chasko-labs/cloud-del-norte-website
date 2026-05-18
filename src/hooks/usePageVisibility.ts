import { useEffect, useState } from "react";

export function usePageVisibility(): boolean {
	const [isVisible, setIsVisible] = useState(
		typeof document !== "undefined" ? !document.hidden : true,
	);
	useEffect(() => {
		function handle() {
			setIsVisible(!document.hidden);
		}
		document.addEventListener("visibilitychange", handle);
		return () => document.removeEventListener("visibilitychange", handle);
	}, []);
	return isVisible;
}
