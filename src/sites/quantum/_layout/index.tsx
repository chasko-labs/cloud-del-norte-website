import type { ReactNode } from "react";
import { LocaleProvider } from "../../../contexts/locale-context";
import type { Locale } from "../../../utils/locale";
import type { Theme } from "../../../utils/theme";

import "./styles.css";

interface QuantumLayoutProps {
	children: ReactNode;
	theme: Theme;
	onThemeChange: (theme: Theme) => void;
	locale: Locale;
	onLocaleChange: (locale: Locale) => void;
}

export default function QuantumLayout({
	children,
	theme,
	onThemeChange,
	locale,
	onLocaleChange,
}: QuantumLayoutProps) {
	return (
		<LocaleProvider locale={locale}>
			<div className="quantum-layout">
				<header className="quantum-toolbar">
					<a
						href="https://quantum.clouddelnorte.org"
						className="quantum-toolbar__brand"
					>
						quantum computing workshop series
					</a>
					<div className="quantum-toolbar__controls">
						<button
							type="button"
							className="quantum-pill"
							onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
							aria-label={
								theme === "dark"
									? "Switch to light mode"
									: "Switch to dark mode"
							}
						>
							{theme === "dark" ? "light" : "dark"}
						</button>
						<button
							type="button"
							className="quantum-pill"
							onClick={() => onLocaleChange(locale === "us" ? "mx" : "us")}
							aria-label={
								locale === "us" ? "Cambiar a español" : "Switch to English"
							}
						>
							{locale === "us" ? "ES" : "EN"}
						</button>
					</div>
				</header>
				<main className="quantum-main">{children}</main>
			</div>
		</LocaleProvider>
	);
}
