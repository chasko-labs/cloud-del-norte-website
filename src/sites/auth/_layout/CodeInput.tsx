// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { useEffect, useRef } from "react";

/**
 * Six-cell verification code input.
 *
 * Plain HTML inputs (Cloudscape has no code-input primitive). Composes the
 * 6 cells into a single combined string via onChange — the parent caller
 * keeps a normal useState<string>, so the existing verify/signup submit
 * handlers don't need to know about cell-level state.
 *
 * Behaviors:
 *   - one digit per cell, numeric mode
 *   - typing auto-tabs forward
 *   - backspace from empty auto-tabs back
 *   - paste a 6-digit string distributes across cells
 *   - each cell briefly flashes amber on entry (.flash CSS class, 280ms)
 */
export default function CodeInput({
	value,
	onChange,
	autoFocus = false,
	"aria-label": ariaLabel = "6-digit verification code",
}: {
	value: string;
	onChange: (next: string) => void;
	autoFocus?: boolean;
	"aria-label"?: string;
}) {
	const refs = useRef<Array<HTMLInputElement | null>>([]);

	useEffect(() => {
		if (autoFocus) refs.current[0]?.focus();
	}, [autoFocus]);

	// Pad / trim to 6 chars so the cells always render an array of length 6
	const cells: string[] = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

	function flashCell(idx: number) {
		const el = refs.current[idx];
		if (!el) return;
		el.classList.remove("flash");
		// force reflow so the animation re-runs
		void el.offsetWidth;
		el.classList.add("flash");
	}

	function setCell(idx: number, ch: string) {
		const next = cells.slice();
		next[idx] = ch;
		onChange(next.join(""));
	}

	function handleChange(idx: number, raw: string) {
		// Only digits — strip everything else
		const digits = raw.replace(/\D/g, "");
		if (digits.length === 0) {
			setCell(idx, "");
			return;
		}
		if (digits.length === 1) {
			setCell(idx, digits);
			flashCell(idx);
			if (idx < 5) refs.current[idx + 1]?.focus();
			return;
		}
		// More than one char in a single input event = paste-into-cell or fast type;
		// distribute across remaining cells starting at idx
		const next = cells.slice();
		for (let i = 0; i < digits.length && idx + i < 6; i++) {
			next[idx + i] = digits[i];
			flashCell(idx + i);
		}
		onChange(next.join(""));
		const focusTarget = Math.min(idx + digits.length, 5);
		refs.current[focusTarget]?.focus();
	}

	function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Backspace" && cells[idx] === "" && idx > 0) {
			// auto-tab back on backspace from empty cell
			refs.current[idx - 1]?.focus();
			e.preventDefault();
		} else if (e.key === "ArrowLeft" && idx > 0) {
			refs.current[idx - 1]?.focus();
			e.preventDefault();
		} else if (e.key === "ArrowRight" && idx < 5) {
			refs.current[idx + 1]?.focus();
			e.preventDefault();
		}
	}

	function handlePaste(idx: number, e: React.ClipboardEvent<HTMLInputElement>) {
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
		if (pasted.length === 0) return;
		e.preventDefault();
		const next = cells.slice();
		for (let i = 0; i < pasted.length && idx + i < 6; i++) {
			next[idx + i] = pasted[i];
			flashCell(idx + i);
		}
		onChange(next.join(""));
		const focusTarget = Math.min(idx + pasted.length, 5);
		refs.current[focusTarget]?.focus();
	}

	return (
		<div
			className="cdn-auth-code-row"
			role="group"
			aria-label={ariaLabel}
		>
			{cells.map((ch, i) => (
				<input
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length 6-cell row
					key={i}
					ref={(el) => {
						refs.current[i] = el;
					}}
					className="cdn-auth-code-cell"
					type="text"
					inputMode="numeric"
					autoComplete={i === 0 ? "one-time-code" : "off"}
					maxLength={1}
					value={ch}
					onChange={(e) => handleChange(i, e.target.value)}
					onKeyDown={(e) => handleKeyDown(i, e)}
					onPaste={(e) => handlePaste(i, e)}
					aria-label={`Digit ${i + 1} of 6`}
				/>
			))}
		</div>
	);
}
