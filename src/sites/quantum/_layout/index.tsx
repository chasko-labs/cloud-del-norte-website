import SpaceBetween from "@cloudscape-design/components/space-between";
import Toggle from "@cloudscape-design/components/toggle";
import type { ReactNode } from "react";
import { LocaleProvider } from "../../../contexts/locale-context";
import { useTranslation } from "../../../hooks/useTranslation";
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

function QuantumToolbar({
	theme,
	onThemeChange,
	locale,
	onLocaleChange,
}: Pick<
	QuantumLayoutProps,
	"theme" | "onThemeChange" | "locale" | "onLocaleChange"
>) {
	const { t } = useTranslation();

	return (
		<header className="quantum-toolbar">
			<SpaceBetween size="s" direction="horizontal" alignItems="center">
				<Toggle
					checked={theme === "dark"}
					onChange={({ detail }) =>
						onThemeChange(detail.checked ? "dark" : "light")
					}
				>
					{theme === "dark"
						? t("shell.switchToLightMode")
						: t("shell.switchToDarkMode")}
				</Toggle>
				<Toggle
					checked={locale === "mx"}
					onChange={({ detail }) =>
						onLocaleChange(detail.checked ? "mx" : "us")
					}
				>
					{locale === "mx" ? "ES" : "EN"}
				</Toggle>
			</SpaceBetween>
		</header>
	);
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
				<QuantumToolbar
					theme={theme}
					onThemeChange={onThemeChange}
					locale={locale}
					onLocaleChange={onLocaleChange}
				/>
				<main className="quantum-main">{children}</main>
			</div>
		</LocaleProvider>
	);
}
