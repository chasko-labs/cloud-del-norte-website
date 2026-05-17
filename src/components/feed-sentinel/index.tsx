import { useEffect, useRef } from "react";

interface FeedSentinelProps {
	onVisible: () => void;
	hasMore: boolean;
}

export function FeedSentinel({ onVisible, hasMore }: FeedSentinelProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!hasMore) return;
		const el = ref.current;
		if (!el) return;
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) onVisible();
			},
			// rootMargin 400px: preload earlier so first-append fires on short pages
			// without requiring multiple scrolls (Wave 16 verifier — was 300px).
			{ rootMargin: "400px", threshold: 0.1 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [hasMore, onVisible]);

	if (!hasMore) return null;
	return <div ref={ref} aria-hidden="true" style={{ height: 1 }} />;
}
