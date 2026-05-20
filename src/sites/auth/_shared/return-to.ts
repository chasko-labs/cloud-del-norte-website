const KEY = "cdn.returnTo";

/** Reads return_to from search params first, then sessionStorage, empty-string fallback. */
export function getReturnTo(): string {
	const fromSearch =
		new URLSearchParams(window.location.search).get("return_to") ?? "";
	if (fromSearch) return fromSearch;
	return sessionStorage.getItem(KEY) ?? "";
}

/** Persists return_to to sessionStorage so cross-page redirects can recover it. */
export function stashReturnTo(value: string): void {
	if (value) sessionStorage.setItem(KEY, value);
}

/** Clears the stashed return_to after it has been consumed. */
export function clearReturnTo(): void {
	sessionStorage.removeItem(KEY);
}
