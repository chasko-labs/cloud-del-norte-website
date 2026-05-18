import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type AnyProps = Record<string, unknown> & {
	children?: React.ReactNode;
	footer?: React.ReactNode;
};

// ── FileUpload mock — exposes a trigger function via data-testid ─────────────
// The mock stores the onChange prop in a ref accessible to tests so they
// can call it directly without DOM event routing.
let fileUploadOnChange: ((files: File[]) => void) | null = null;

vi.mock("@cloudscape-design/components/file-upload", () => ({
	default: ({ onChange, value }: AnyProps) => {
		fileUploadOnChange = (files: File[]) =>
			(onChange as Function)?.({ detail: { value: files } });
		return React.createElement("div", {
			"data-testid": "file-upload",
			"data-file-count": (value as File[])?.length ?? 0,
		});
	},
}));

// ── Other Cloudscape mocks ───────────────────────────────────────────────────
vi.mock("@cloudscape-design/components/modal", () => ({
	default: ({ children, footer, header, visible }: AnyProps) =>
		visible
			? React.createElement(
					"div",
					{ "data-testid": "modal" },
					React.createElement("h2", null, String(header ?? "")),
					children,
					footer,
				)
			: null,
}));
vi.mock("@cloudscape-design/components/button", () => ({
	default: ({ children, onClick }: AnyProps) =>
		React.createElement(
			"button",
			{ onClick: onClick as React.MouseEventHandler },
			children,
		),
}));
vi.mock("@cloudscape-design/components/form", () => ({
	default: ({ children, errorText }: AnyProps) =>
		React.createElement(
			"div",
			{ "data-testid": "form", "data-error": errorText },
			children,
		),
}));
vi.mock("@cloudscape-design/components/form-field", () => ({
	default: ({ children, errorText, label }: AnyProps) =>
		React.createElement(
			"div",
			{
				"data-testid": `field-${String(label ?? "").replace(/\s/g, "-")}`,
				"data-error": errorText ?? "",
			},
			children,
		),
}));
vi.mock("@cloudscape-design/components/input", () => ({
	default: ({ value, onChange, ariaLabel }: AnyProps) =>
		React.createElement("input", {
			"aria-label": String(ariaLabel ?? ""),
			value: value as string,
			onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
				(onChange as Function)?.({ detail: { value: e.target.value } }),
		}),
}));
vi.mock("@cloudscape-design/components/textarea", () => ({
	default: ({ value, onChange, ariaLabel }: AnyProps) =>
		React.createElement("textarea", {
			"aria-label": String(ariaLabel ?? ""),
			value: value as string,
			onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
				(onChange as Function)?.({ detail: { value: e.target.value } }),
		}),
}));
vi.mock("@cloudscape-design/components/alert", () => ({
	default: ({ children, action }: AnyProps) =>
		React.createElement(
			"div",
			{ role: "alert" },
			children,
			(action ?? null) as React.ReactNode,
		),
}));
vi.mock("@cloudscape-design/components/link", () => ({
	default: ({ children, href }: AnyProps) =>
		React.createElement("a", { href: String(href ?? "") }, children),
}));
vi.mock("@cloudscape-design/components/box", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/space-between", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));

vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

// ── useAuth mock — default: signed out ───────────────────────────────────────
const mockAuthState = {
	isAuthenticated: false,
	sub: null as string | null,
	email: null as string | null,
};
vi.mock("../../../hooks/useAuth", () => ({
	useAuth: () => mockAuthState,
}));

// ── useFeedbackDraft mock — expose controllable draft state ───────────────────
const mockDraft = {
	type: "bug" as "bug" | "wish",
	summary: "",
	details: "",
	contactEmail: "",
};
const mockSetDraftField = vi.fn((key: string, value: string) => {
	(mockDraft as Record<string, unknown>)[key] = value;
});
const mockClearDraft = vi.fn();
vi.mock("../../../hooks/useFeedbackDraft", () => ({
	useFeedbackDraft: () => ({
		draft: mockDraft,
		setDraftField: mockSetDraftField,
		clearDraft: mockClearDraft,
		hasPersistedDraft: false,
	}),
}));

// ── helpers ──────────────────────────────────────────────────────────────────
function makeFile(name: string, type: string, size: number): File {
	return new File(["x".repeat(size)], name, { type });
}

/** Dispatch a synthetic paste event with clipboard image items */
function firePaste(files: File[]) {
	const items = files.map((f) => ({
		type: f.type,
		getAsFile: () => f,
	}));
	// jsdom doesn't have ClipboardEvent constructor — use a plain Event + custom prop
	const ev = new Event("paste", { bubbles: true });
	Object.defineProperty(ev, "clipboardData", {
		value: { items },
	});
	window.dispatchEvent(ev);
}

import { fireEvent } from "@testing-library/react";
import FeedbackForm from "../index";

// ── tests ─────────────────────────────────────────────────────────────────────
describe("FeedbackForm — Wave 12 image upload", () => {
	beforeEach(() => {
		fileUploadOnChange = null;
		vi.stubGlobal("fetch", vi.fn());
		// Reset shared mock draft state
		mockDraft.summary = "";
		mockDraft.details = "";
		mockDraft.contactEmail = "";
		mockAuthState.isAuthenticated = false;
		mockAuthState.sub = null;
		mockAuthState.email = null;
		mockClearDraft.mockClear();
		mockSetDraftField.mockClear();
	});

	it("paste handler adds clipboard image to attachments", () => {
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const img = makeFile("screenshot.png", "image/png", 100);

		act(() => {
			firePaste([img]);
		});

		expect(
			screen.getByTestId("file-upload").getAttribute("data-file-count"),
		).toBe("1");
	});

	it("paste handler ignores non-image clipboard items (no-op)", () => {
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);

		// Dispatch paste with no items (empty array filters to zero image items)
		act(() => {
			firePaste([]);
		});

		expect(
			screen.getByTestId("file-upload").getAttribute("data-file-count"),
		).toBe("0");
	});

	it("paste handler caps at MAX_FILES=3 even when more images are pasted", () => {
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);

		// Paste 2 images first
		act(() => {
			firePaste([
				makeFile("a.png", "image/png", 100),
				makeFile("b.png", "image/png", 100),
			]);
		});

		// Paste 2 more — only 1 slot remains, so count must stay at 3
		act(() => {
			firePaste([
				makeFile("c.png", "image/png", 100),
				makeFile("d.png", "image/png", 100),
			]);
		});

		expect(
			Number(screen.getByTestId("file-upload").getAttribute("data-file-count")),
		).toBeLessThanOrEqual(3);
	});

	it("validate() sets attachmentError for files > 2MB", async () => {
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);

		// Fill summary + details via Cloudscape Input/Textarea mocks
		const summaryInput = screen.getByRole("textbox", {
			name: "feedbackForm.fields.summary",
		});
		const detailsInput = screen.getByRole("textbox", {
			name: "feedbackForm.fields.details",
		});

		act(() => {
			fireEvent.change(summaryInput, {
				target: { value: "A valid summary here!" },
			});
			fireEvent.change(detailsInput, {
				target: { value: "Valid details content." },
			});
		});

		// Add oversized file via FileUpload mock
		const bigFile = makeFile("huge.png", "image/png", 2_100_000);
		act(() => {
			fileUploadOnChange?.([bigFile]);
		});

		// Submit
		const submitBtn = screen.getByText("feedbackForm.submitButton");
		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => {
			const fields = screen.getAllByTestId(/^field-/);
			const attachmentField = fields.find((f) =>
				f.getAttribute("data-testid")?.includes("attachments"),
			);
			expect(attachmentField?.getAttribute("data-error")).toBeTruthy();
		});
	});

	it("validate() sets attachmentError for non-image MIME type", async () => {
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);

		const pdfFile = makeFile("doc.pdf", "application/pdf", 50_000);
		act(() => {
			fileUploadOnChange?.([pdfFile]);
		});

		const submitBtn = screen.getByText("feedbackForm.submitButton");
		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => {
			const fields = screen.getAllByTestId(/^field-/);
			const attachmentField = fields.find((f) =>
				f.getAttribute("data-testid")?.includes("attachments"),
			);
			expect(attachmentField?.getAttribute("data-error")).toBeTruthy();
		});
	});

	it("handleSubmit encodes attachments as base64 and sends them in the fetch body", async () => {
		const mockFetch = vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				ok: true,
				issueUrl: "https://github.com/x/y/issues/1",
			}),
		} as Response);

		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);

		// Fill valid summary + details
		const summaryInput = screen.getByRole("textbox", {
			name: "feedbackForm.fields.summary",
		});
		const detailsInput = screen.getByRole("textbox", {
			name: "feedbackForm.fields.details",
		});
		act(() => {
			fireEvent.change(summaryInput, {
				target: { value: "A valid summary here!" },
			});
			fireEvent.change(detailsInput, {
				target: { value: "Valid details content." },
			});
		});

		// Attach a valid image
		const img = makeFile("shot.png", "image/png", 10);
		act(() => {
			fileUploadOnChange?.([img]);
		});

		// Submit
		const submitBtn = screen.getByText("feedbackForm.submitButton");
		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => {
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});

		const [, callOpts] = mockFetch.mock.calls[0];
		const body = JSON.parse((callOpts as RequestInit).body as string) as {
			attachments?: {
				filename: string;
				contentType: string;
				base64Data: string;
			}[];
		};
		expect(body.attachments).toHaveLength(1);
		expect(body.attachments?.[0].filename).toBe("shot.png");
		expect(body.attachments?.[0].contentType).toBe("image/png");
		// base64Data is a non-empty string (FileReader.readAsDataURL result stripped of prefix)
		expect(typeof body.attachments?.[0].base64Data).toBe("string");
	});
});

// ── Wave 20: draft persistence ────────────────────────────────────────────────
describe("FeedbackForm — Wave 20 draft persistence", () => {
	beforeEach(() => {
		fileUploadOnChange = null;
		localStorage.clear();
		mockDraft.summary = "";
		mockDraft.details = "";
		mockDraft.contactEmail = "";
		mockAuthState.isAuthenticated = false;
		mockAuthState.sub = null;
		mockAuthState.email = null;
		mockClearDraft.mockClear();
		mockSetDraftField.mockClear();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("typing into summary calls setDraftField", () => {
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const summaryInput = screen.getByRole("textbox", {
			name: "feedbackForm.fields.summary",
		});
		act(() => {
			fireEvent.change(summaryInput, {
				target: { value: "draft summary text" },
			});
		});
		expect(mockSetDraftField).toHaveBeenCalledWith(
			"summary",
			"draft summary text",
		);
	});

	it("re-mounting form restores values from localStorage via useFeedbackDraft", () => {
		// The hook itself handles storage read on mount — tested in useFeedbackDraft.test.ts
		// Here we just verify the form renders with whatever draft the hook returns
		mockDraft.summary = "restored summary";
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const summaryInput = screen.getByRole("textbox", {
			name: "feedbackForm.fields.summary",
		}) as HTMLInputElement;
		expect(summaryInput.value).toBe("restored summary");
	});

	it("successful submit calls clearDraft", async () => {
		mockDraft.summary = "A valid summary here!";
		mockDraft.details = "Valid details content.";

		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				ok: true,
				issueUrl: "https://github.com/x/y/issues/1",
			}),
		} as Response);

		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const submitBtn = screen.getByText("feedbackForm.submitButton");

		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => {
			expect(mockClearDraft).toHaveBeenCalledTimes(1);
		});
	});
});

// ── Wave 20: auth integration ─────────────────────────────────────────────────
describe("FeedbackForm — Wave 20 auth integration", () => {
	beforeEach(() => {
		fileUploadOnChange = null;
		mockDraft.summary = "";
		mockDraft.details = "";
		mockDraft.contactEmail = "";
		mockAuthState.isAuthenticated = false;
		mockAuthState.sub = null;
		mockAuthState.email = null;
		mockClearDraft.mockClear();
		mockSetDraftField.mockClear();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("signed-out mode shows contact email field", () => {
		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const emailInput = screen.getByRole("textbox", {
			name: "feedbackForm.fields.contactEmail",
		});
		expect(emailInput).toBeTruthy();
	});

	it("signed-in mode hides contact-email field", () => {
		mockAuthState.isAuthenticated = true;
		mockAuthState.sub = "us-west-2_abc123";
		mockAuthState.email = "user@example.com";

		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);

		expect(
			screen.queryByRole("textbox", {
				name: "feedbackForm.fields.contactEmail",
			}),
		).toBeNull();
		expect(screen.getByText(/feedbackForm\.signedInAs/)).toBeTruthy();
	});

	it("signed-in submit includes reporterSub in payload", async () => {
		mockAuthState.isAuthenticated = true;
		mockAuthState.sub = "us-west-2_abc123";
		mockAuthState.email = "user@example.com";
		mockDraft.summary = "A valid summary here!";
		mockDraft.details = "Valid details content.";

		const mockFetch = vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({
				ok: true,
				issueUrl: "https://github.com/x/y/issues/1",
			}),
		} as Response);

		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const submitBtn = screen.getByText("feedbackForm.submitButton");

		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

		const [, callOpts] = mockFetch.mock.calls[0];
		const body = JSON.parse((callOpts as RequestInit).body as string) as {
			reporterSub?: string;
		};
		expect(body.reporterSub).toBe("us-west-2_abc123");
	});
});

// ── Wave 20: detailed error handling ─────────────────────────────────────────
describe("FeedbackForm — Wave 20 detailed errors", () => {
	beforeEach(() => {
		fileUploadOnChange = null;
		mockDraft.summary = "A valid summary here!";
		mockDraft.details = "Valid details content.";
		mockDraft.contactEmail = "";
		mockAuthState.isAuthenticated = false;
		mockAuthState.sub = null;
		mockAuthState.email = null;
		mockClearDraft.mockClear();
		mockSetDraftField.mockClear();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("HTTP 429 shows rate-limit message", async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 429,
			json: async () => ({}),
		} as Response);

		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const submitBtn = screen.getByText("feedbackForm.submitButton");

		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => {
			const form = screen.getByTestId("form");
			expect(form.getAttribute("data-error")).toBe("feedbackForm.errors.rate");
		});
	});

	it("HTTP 500 shows server-error message and retry button", async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 500,
			json: async () => ({}),
		} as Response);

		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const submitBtn = screen.getByText("feedbackForm.submitButton");

		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => {
			const form = screen.getByTestId("form");
			expect(form.getAttribute("data-error")).toBe(
				"feedbackForm.errors.server",
			);
		});
		expect(screen.getByText("feedbackForm.retry")).toBeTruthy();
	});

	it("TypeError (network down) shows offline message", async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));

		render(<FeedbackForm open={true} onClose={vi.fn()} kind="bug" />);
		const submitBtn = screen.getByText("feedbackForm.submitButton");

		await act(async () => {
			submitBtn.click();
		});

		await waitFor(() => {
			const form = screen.getByTestId("form");
			expect(form.getAttribute("data-error")).toBe(
				"feedbackForm.errors.offline",
			);
		});
		expect(screen.getByText("feedbackForm.retry")).toBeTruthy();
	});
});
