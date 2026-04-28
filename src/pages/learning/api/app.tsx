import { useState } from "react";
import Breadcrumbs from "../../../components/breadcrumbs";
import Navigation from "../../../components/navigation";
import { useTranslation } from "../../../hooks/useTranslation";
import Shell from "../../../layouts/shell";
import {
	applyLocale,
	initializeLocale,
	type Locale,
	setStoredLocale,
} from "../../../utils/locale";
import {
	applyTheme,
	initializeTheme,
	setStoredTheme,
	type Theme,
} from "../../../utils/theme";
import RiftRewindDashboard from "./RiftRewindDashboard";

function BreadcrumbsContent() {
	const { t } = useTranslation();
	return (
		<Breadcrumbs
			active={{ text: t("navigation.apiGuide"), href: "/learning/api/" }}
		/>
	);
}

export default function App() {
	const [theme, setTheme] = useState<Theme>(() => initializeTheme());
	const [locale, setLocale] = useState<Locale>(() => initializeLocale());

	const handleThemeChange = (newTheme: Theme) => {
		setTheme(newTheme);
		applyTheme(newTheme);
		setStoredTheme(newTheme);
	};

	const handleLocaleChange = (newLocale: Locale) => {
		setLocale(newLocale);
		applyLocale(newLocale);
		setStoredLocale(newLocale);
	};

	return (
		<Shell
			theme={theme}
			onThemeChange={handleThemeChange}
			locale={locale}
			onLocaleChange={handleLocaleChange}
			pageTitle="learning.api.title"
			breadcrumbs={<BreadcrumbsContent />}
			navigation={<Navigation />}
		>
			<RiftRewindDashboard />
		</Shell>
	);
}
