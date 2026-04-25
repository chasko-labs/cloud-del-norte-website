// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { createContext, type ReactNode } from "react";
import enUS from "../locales/en-US.json";
import esMX from "../locales/es-MX.json";
import type { Locale } from "../utils/locale";

export interface LocaleContextValue {
	locale: Locale;
	t: (key: string) => string;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

interface LocaleProviderProps {
	locale: Locale;
	children: ReactNode;
}

const translations = {
	us: enUS,
	mx: esMX,
};

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
	const t = (key: string): string => {
		const keys = key.split(".");
		let value: unknown = translations[locale];

		for (const k of keys) {
			if (
				value &&
				typeof value === "object" &&
				k in (value as Record<string, unknown>)
			) {
				value = (value as Record<string, unknown>)[k];
			} else {
				// Fallback to en-US
				value = translations.us;
				for (const fallbackKey of keys) {
					if (
						value &&
						typeof value === "object" &&
						fallbackKey in (value as Record<string, unknown>)
					) {
						value = (value as Record<string, unknown>)[fallbackKey];
					} else {
						return key; // Return key if not found
					}
				}
				if (typeof value === "string") {
					return value;
				}
				return key;
			}
		}

		return typeof value === "string" ? value : key;
	};

	return (
		<LocaleContext.Provider value={{ locale, t }}>
			{children}
		</LocaleContext.Provider>
	);
}
