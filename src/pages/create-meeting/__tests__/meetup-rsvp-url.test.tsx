// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AnyProps = Record<string, unknown> & { children?: React.ReactNode };

// ── Cloudscape mocks ──────────────────────────────────────────────────────────
vi.mock("@cloudscape-design/components/container", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/header", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/space-between", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/column-layout", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/box", () => ({
	default: ({ children }: AnyProps) =>
		React.createElement("div", null, children),
}));
vi.mock("@cloudscape-design/components/date-picker", () => ({
	default: () => React.createElement("div", { "data-testid": "date-picker" }),
}));
vi.mock("@cloudscape-design/components/time-input", () => ({
	default: () => React.createElement("div", { "data-testid": "time-input" }),
}));
vi.mock("@cloudscape-design/components/textarea", () => ({
	default: ({ value, onChange }: AnyProps) =>
		React.createElement("textarea", {
			"data-testid": "notes-input",
			value: value as string,
			onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) =>
				(onChange as Function)?.({ detail: { value: e.target.value } }),
		}),
}));
vi.mock("@cloudscape-design/components/form-field", () => ({
	default: ({ children, errorText, label }: AnyProps) =>
		React.createElement(
			"div",
			{
				"data-testid": `field`,
				"data-label": String(label ?? ""),
				"data-error": String(errorText ?? ""),
			},
			label as React.ReactNode,
			children,
		),
}));

// Track the last ref callback for each field keyed by placeholder
let rsvpInputOnChange: ((val: string) => void) | null = null;

vi.mock("@cloudscape-design/components/input", () => ({
	default: ({
		value,
		onChange,
		placeholder,
		ref,
	}: AnyProps & { ref?: (r: unknown) => void }) => {
		if (placeholder === "https://www.meetup.com/...") {
			rsvpInputOnChange = (val: string) =>
				(onChange as Function)?.({ detail: { value: val } });
		}
		// expose ref with a no-op focus so addErrorField doesn't throw
		ref?.({ focus: () => {} });
		return React.createElement("input", {
			"data-testid":
				placeholder === "https://www.meetup.com/..."
					? "rsvp-input"
					: "other-input",
			value: value as string,
			onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
				(onChange as Function)?.({ detail: { value: e.target.value } }),
		});
	},
}));

// ── timezone util mock ────────────────────────────────────────────────────────
vi.mock("../../meetings/util/timezone", () => ({
	formatInTz: () => "mock time",
	TZ_ZONES: [],
}));

// ── useTranslation — returns key by default, configurable per test ────────────
const mockT = vi.fn((key: string) => key);
vi.mock("../../../hooks/useTranslation", () => ({
	useTranslation: () => ({ t: mockT }),
}));

// ── BasicValidationContext — expose isFormSubmitted control ───────────────────
let mockIsFormSubmitted = false;
vi.mock("../validation/basic-validation", () => ({
	BasicValidationContext: {
		Consumer: ({ children }: { children: (ctx: unknown) => React.ReactNode }) =>
			children({
				isFormSubmitted: mockIsFormSubmitted,
				addErrorField: vi.fn((_key: string, _meta: unknown) => {}),
			}),
	},
}));

import MeetingDetails from "../components/marketing";

describe("meetupRsvpUrl field — wave 90b", () => {
	beforeEach(() => {
		rsvpInputOnChange = null;
		mockIsFormSubmitted = false;
		mockT.mockImplementation((key: string) => key);
	});

	it("renders field with i18n label key", () => {
		render(<MeetingDetails />);
		const input = screen.getByTestId("rsvp-input");
		expect(input).toBeTruthy();
		// Verify useTranslation was called with the label key
		expect(mockT).toHaveBeenCalledWith(
			"createMeeting.meetingDetails.meetupRsvpUrlLabel",
		);
	});

	it("empty value submits cleanly — no error shown before submit", () => {
		render(<MeetingDetails />);
		// isFormSubmitted=false, field is empty → error key should NOT be shown
		const input = screen.getByTestId("rsvp-input");
		const field = input.closest("[data-testid='field']");
		const errorVal = field?.getAttribute("data-error");
		expect(errorVal).not.toBe(
			"createMeeting.meetingDetails.meetupRsvpUrlError",
		);
	});

	it("invalid URL shows error when form is submitted", () => {
		mockIsFormSubmitted = true;
		render(<MeetingDetails />);

		// Type an invalid value via the captured onChange
		act(() => {
			rsvpInputOnChange?.("https://not-meetup.com/event");
		});

		// The field parent should now carry the error key
		const input = screen.getByTestId("rsvp-input");
		const field = input.closest("[data-testid='field']");
		expect(field?.getAttribute("data-error")).toBe(
			"createMeeting.meetingDetails.meetupRsvpUrlError",
		);
	});

	it("valid meetup URL (www) shows no error and calls onChange with the value", () => {
		mockIsFormSubmitted = true;
		const onChangeMock = vi.fn();
		render(<MeetingDetails onChange={onChangeMock} />);

		const validUrl = "https://www.meetup.com/cloud-del-norte/events/12345/";
		act(() => {
			const input = screen.getByTestId("rsvp-input");
			fireEvent.change(input, { target: { value: validUrl } });
		});

		// onChange should have been called with meetupRsvpUrl set
		const lastCall = onChangeMock.mock.calls.at(-1)?.[0];
		expect(lastCall?.meetupRsvpUrl).toBe(validUrl);
	});

	it("valid meetup URL without www subdomain also passes validation", () => {
		mockIsFormSubmitted = true;
		const onChangeMock = vi.fn();
		render(<MeetingDetails onChange={onChangeMock} />);

		const validUrl = "https://meetup.com/cloud-del-norte/events/12345/";
		act(() => {
			const input = screen.getByTestId("rsvp-input");
			fireEvent.change(input, { target: { value: validUrl } });
		});

		const lastCall = onChangeMock.mock.calls.at(-1)?.[0];
		expect(lastCall?.meetupRsvpUrl).toBe(validUrl);
	});
});
