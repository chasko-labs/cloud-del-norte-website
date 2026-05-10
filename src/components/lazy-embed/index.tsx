import { useInView } from "../../hooks/useInView";

interface LazyEmbedProps {
	src: string;
	title: string;
	allow?: string;
	aspectRatio?: string;
}

export function LazyEmbed({
	src,
	title,
	allow,
	aspectRatio = "16/9",
}: LazyEmbedProps) {
	const { ref, inView } = useInView();
	return (
		<div ref={ref} style={{ aspectRatio, width: "100%" }}>
			{inView && (
				<iframe
					src={src}
					title={title}
					allow={allow}
					style={{ width: "100%", height: "100%", border: "none" }}
				/>
			)}
		</div>
	);
}
