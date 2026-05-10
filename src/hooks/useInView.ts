import { useEffect, useRef, useState } from "react";

/** Returns a ref and a boolean that flips to true once the element enters the viewport. */
export function useInView(rootMargin = "200px") {
	const ref = useRef<HTMLDivElement>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el || inView) return;
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					setInView(true);
					io.disconnect();
				}
			},
			{ rootMargin },
		);
		io.observe(el);
		return () => io.disconnect();
	}, [inView, rootMargin]);

	return { ref, inView };
}
