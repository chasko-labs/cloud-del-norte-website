import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth", () => ({
	getIdToken: vi.fn(),
	refreshTokens: vi.fn(),
}));

function mockResponse(status: number, body: unknown): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as unknown as Response;
}

describe("jitsi-token", () => {
	beforeEach(async () => {
		vi.resetModules();
		const { getIdToken, refreshTokens } = await import("../auth");
		(getIdToken as ReturnType<typeof vi.fn>).mockReset();
		(refreshTokens as ReturnType<typeof vi.fn>).mockReset();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("throws when not authenticated", async () => {
		const { getIdToken } = await import("../auth");
		(getIdToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
		const { fetchJitsiToken, clearJitsiTokenCache } = await import(
			"../jitsi-token"
		);
		clearJitsiTokenCache();
		await expect(fetchJitsiToken()).rejects.toThrow(/not authenticated/);
	});

	it("happy path returns parsed response and sends bearer token", async () => {
		const { getIdToken } = await import("../auth");
		(getIdToken as ReturnType<typeof vi.fn>).mockReturnValue("id-abc");
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			mockResponse(200, {
				token: "jitsi-jwt",
				domain: "meet.clouddelnorte.org",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
			}),
		);
		const { fetchJitsiToken, clearJitsiTokenCache } = await import(
			"../jitsi-token"
		);
		clearJitsiTokenCache();

		const res = await fetchJitsiToken();
		expect(res.token).toBe("jitsi-jwt");
		expect(res.domain).toBe("meet.clouddelnorte.org");

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(String(url)).toBe(
			"https://rwmypxz9z6.execute-api.us-west-2.amazonaws.com/token/jitsi",
		);
		expect((init as RequestInit).method).toBe("POST");
		expect((init as RequestInit).headers).toMatchObject({
			Authorization: "Bearer id-abc",
		});
	});

	it("throws BannedUserError on 403", async () => {
		const { getIdToken } = await import("../auth");
		(getIdToken as ReturnType<typeof vi.fn>).mockReturnValue("id-x");
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			mockResponse(403, { message: "banned" }),
		);
		const { fetchJitsiToken, BannedUserError, clearJitsiTokenCache } =
			await import("../jitsi-token");
		clearJitsiTokenCache();
		await expect(fetchJitsiToken()).rejects.toBeInstanceOf(BannedUserError);
	});

	it("on 401 refreshes and retries once", async () => {
		const { getIdToken, refreshTokens } = await import("../auth");
		(getIdToken as ReturnType<typeof vi.fn>)
			.mockReturnValueOnce("stale")
			.mockReturnValueOnce("fresh");
		(refreshTokens as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(mockResponse(401, {}))
			.mockResolvedValueOnce(
				mockResponse(200, {
					token: "jitsi-jwt-2",
					domain: "meet.clouddelnorte.org",
					expiresAt: Math.floor(Date.now() / 1000) + 3600,
				}),
			);

		const { fetchJitsiToken, clearJitsiTokenCache } = await import(
			"../jitsi-token"
		);
		clearJitsiTokenCache();
		const res = await fetchJitsiToken();
		expect(res.token).toBe("jitsi-jwt-2");
		expect(refreshTokens).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
		expect(fetchSpy.mock.calls[1][1]).toMatchObject({
			headers: { Authorization: "Bearer fresh" },
		});
	});

	it("caches the token within expiry window", async () => {
		const { getIdToken } = await import("../auth");
		(getIdToken as ReturnType<typeof vi.fn>).mockReturnValue("id-abc");
		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			mockResponse(200, {
				token: "cached-jwt",
				domain: "meet.clouddelnorte.org",
				expiresAt: Math.floor(Date.now() / 1000) + 3600,
			}),
		);
		const { fetchJitsiToken, clearJitsiTokenCache } = await import(
			"../jitsi-token"
		);
		clearJitsiTokenCache();

		const a = await fetchJitsiToken();
		const b = await fetchJitsiToken();
		expect(a).toBe(b);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});
});
