import { useContext } from "react";
import type { LocaleContextValue } from "../contexts/locale-context";
import { LocaleContext } from "../contexts/locale-context";

export function useTranslation(): LocaleContextValue {
	const context = useContext(LocaleContext);
	if (!context) {
		throw new Error("useTranslation must be used within a LocaleProvider");
	}
	return context;
}
