import type { ReactNode } from "react";
import "./styles.css";

interface Props {
	children: ReactNode;
	loaded?: boolean;
}

export function LoadingAtmosphere({ children, loaded }: Props) {
	return (
		<div
			className="cdn-loading-atmosphere"
			data-loaded={loaded ? "true" : undefined}
		>
			{children}
		</div>
	);
}

export default LoadingAtmosphere;
