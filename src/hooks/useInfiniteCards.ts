import { useCallback, useEffect, useRef, useState } from "react";

const MOBILE_BREAKPOINT = 689;
const batchSize = () => (window.innerWidth < MOBILE_BREAKPOINT ? 2 : 4);

export function useInfiniteCards<T>(cards: T[]) {
	const [visibleCount, setVisibleCount] = useState(() => batchSize());
	// keep cards.length in a ref so the matchMedia callback doesn't close over stale length
	const cardsLenRef = useRef(cards.length);
	cardsLenRef.current = cards.length;

	useEffect(() => {
		const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
		const handler = () => {
			const batch = batchSize();
			// snap visible count to the nearest multiple of the new batch size,
			// but never below 1 batch and never above cards.length
			setVisibleCount((c) =>
				Math.min(
					Math.max(Math.ceil(c / batch) * batch, batch),
					cardsLenRef.current,
				),
			);
		};
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const incrementVisible = useCallback(() => {
		const batch = batchSize();
		setVisibleCount((c) => Math.min(c + batch, cardsLenRef.current));
	}, []);

	return {
		visibleCount,
		incrementVisible,
		visibleCards: cards.slice(0, visibleCount),
		hasMore: visibleCount < cards.length,
	};
}
