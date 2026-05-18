import { useEffect, useRef, useState } from "react";

export interface FeedbackDraft {
	type: "bug" | "wish";
	summary: string;
	details: string;
	contactEmail: string;
}

const EMPTY = (kind: "bug" | "wish"): FeedbackDraft => ({
	type: kind,
	summary: "",
	details: "",
	contactEmail: "",
});

function storageKey(kind: "bug" | "wish"): string {
	return `cdn-feedback-draft-${kind}`;
}

function readFromStorage(kind: "bug" | "wish"): FeedbackDraft | null {
	try {
		const raw = localStorage.getItem(storageKey(kind));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as FeedbackDraft;
		return parsed;
	} catch {
		return null;
	}
}

export function useFeedbackDraft(kind: "bug" | "wish"): {
	draft: FeedbackDraft;
	setDraftField: <K extends keyof FeedbackDraft>(
		key: K,
		value: FeedbackDraft[K],
	) => void;
	clearDraft: () => void;
	hasPersistedDraft: boolean;
} {
	const persisted = readFromStorage(kind);
	const [draft, setDraft] = useState<FeedbackDraft>(persisted ?? EMPTY(kind));
	const [hasPersistedDraft] = useState<boolean>(persisted !== null);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	function setDraftField<K extends keyof FeedbackDraft>(
		key: K,
		value: FeedbackDraft[K],
	): void {
		setDraft((prev) => {
			const next = { ...prev, [key]: value };
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				try {
					localStorage.setItem(storageKey(kind), JSON.stringify(next));
				} catch {
					// localStorage unavailable — silently ignore
				}
			}, 500);
			return next;
		});
	}

	function clearDraft(): void {
		if (timerRef.current) clearTimeout(timerRef.current);
		try {
			localStorage.removeItem(storageKey(kind));
		} catch {
			// ignore
		}
		setDraft(EMPTY(kind));
	}

	return { draft, setDraftField, clearDraft, hasPersistedDraft };
}
