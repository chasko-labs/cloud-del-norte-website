// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import type React from "react";
import "./styles.css";

/**
 * cdn-card — primitive card component for the tumblr-style card wall.
 *
 * geometry guarantee: the rendered card always has a fixed min-height matching
 * its slot tier. inner content positions absolutely within the slot, so growing
 * / shrinking content cannot push siblings or trigger ancestor reflow. paired
 * with cdn-wall's `contain: layout` per slot, child mutations are confined to
 * the slot they live in.
 *
 * lifecycle: card always renders the slot. internal state branches map to:
 *   - loading        → fallback inside slot
 *   - data ready     → render(data) inside slot, cross-fading from prior
 *   - error          → errorState inside slot
 *   - empty data     → fallback inside slot
 * card never unmounts mid-session except at parent level (filter / removal).
 *
 * sticky lifecycle (default true): when new data is null / undefined / errored,
 * the previously-rendered content stays on screen. transient api failures do
 * not flap visible content. compose with useStickyPoll on the data side for
 * full flap suppression at both layers.
 *
 * sticky=false: every render replaces content immediately, including with
 * fallback / error states. use only when the card represents momentary state
 * that benefits from instant feedback (rare).
 */

export type CdnCardSlot = "narrow" | "standard" | "wide" | "hero";

export type CdnCardState<T> =
	| { kind: "loading" }
	| { kind: "ready"; data: T }
	| { kind: "empty" }
	| { kind: "error"; reason?: string };

export interface CdnCardProps<T> {
	/** stable id for react keying + analytics. must not change across renders. */
	id: string;
	/** slot tier — controls min-height + contain:layout boundary */
	slot: CdnCardSlot;
	/** current data state — drives which branch renders inside the slot */
	state: CdnCardState<T>;
	/** render function — receives data when state.kind === "ready" */
	render: (data: T) => React.ReactNode;
	/** geometry-stable skeleton / empty placeholder; rendered for loading + empty */
	fallback: React.ReactNode;
	/** geometry-stable error JSX; receives reason from state.kind === "error" */
	errorState: React.ReactNode | ((reason?: string) => React.ReactNode);
	/** preserve last successful content during refresh / transient errors. default true */
	sticky?: boolean;
	/** cross-fade duration on content swap. default 300ms */
	transitionMs?: number;
	/** optional className passthrough — applied to the slot wrapper */
	className?: string;
}

import { useEffect, useRef, useState } from "react";

interface RenderedFrame {
	/** monotonic key — increments on every state-driven content swap */
	key: number;
	/** snapshot of the JSX rendered for this frame */
	node: React.ReactNode;
}

export default function CdnCard<T>(props: CdnCardProps<T>) {
	const {
		id,
		slot,
		state,
		render,
		fallback,
		errorState,
		sticky = true,
		transitionMs = 300,
		className,
	} = props;

	// derive the JSX that this state would produce. stickiness gates whether we
	// commit it as the new "current frame" or keep showing the prior one.
	const candidate: RenderedFrame | null = (() => {
		if (state.kind === "ready") {
			return { key: 0, node: render(state.data) };
		}
		if (state.kind === "loading" || state.kind === "empty") {
			return { key: 0, node: fallback };
		}
		// error
		const errNode =
			typeof errorState === "function" ? errorState(state.reason) : errorState;
		return { key: 0, node: errNode };
	})();

	// frame stack: [previous (fading out), current (fading in)]. when stickiness
	// says "keep prior", we don't push a new frame at all.
	const frameCounterRef = useRef(0);
	const [frames, setFrames] = useState<RenderedFrame[]>(() => {
		frameCounterRef.current = 1;
		return candidate ? [{ key: 1, node: candidate.node }] : [];
	});

	// remember the last "successful" state kind so stickiness only suppresses
	// loading / error transitions; real ready→ready content swaps still cross-fade.
	const lastReadyRef = useRef<boolean>(state.kind === "ready");

	useEffect(() => {
		const isReady = state.kind === "ready";
		const hasPriorReady = lastReadyRef.current;

		// stickiness: if we already showed ready content and the new state is
		// loading or error, do not swap — keep the prior frame on screen.
		if (
			sticky &&
			hasPriorReady &&
			(state.kind === "loading" || state.kind === "error")
		) {
			return;
		}

		// commit a new frame
		frameCounterRef.current += 1;
		const next: RenderedFrame = {
			key: frameCounterRef.current,
			node: candidate?.node ?? null,
		};

		setFrames((prev) => {
			// keep the most recent prior frame for the cross-fade; drop older.
			const tail = prev.length > 0 ? [prev[prev.length - 1]] : [];
			return [...tail, next];
		});

		if (isReady) lastReadyRef.current = true;
		// biome-ignore lint/correctness/useExhaustiveDependencies: candidate is derived from state every render; using state.kind + ready data identity to drive swaps avoids re-running on referential churn of the rendered jsx
	}, [state.kind, state.kind === "ready" ? state.data : null, sticky]);

	// after transitionMs, drop the trailing (faded-out) frame so the dom does
	// not accumulate stale content. the slot itself always remains.
	useEffect(() => {
		if (frames.length <= 1) return;
		const id = window.setTimeout(() => {
			setFrames((prev) => (prev.length > 1 ? prev.slice(-1) : prev));
		}, transitionMs);
		return () => window.clearTimeout(id);
	}, [frames.length, transitionMs]);

	const slotClass = `cdn-card-slot cdn-card-slot--${slot}${className ? ` ${className}` : ""}`;

	return (
		<div
			className={slotClass}
			data-cdn-card-id={id}
			data-cdn-card-state={state.kind}
			style={
				{
					"--cdn-card-transition-ms": `${transitionMs}ms`,
				} as React.CSSProperties & Record<string, string>
			}
		>
			{frames.map((f, i) => {
				const isCurrent = i === frames.length - 1;
				return (
					<div
						key={f.key}
						className={`cdn-card-frame${isCurrent ? " cdn-card-frame--current" : " cdn-card-frame--leaving"}`}
						aria-hidden={isCurrent ? undefined : true}
					>
						{f.node}
					</div>
				);
			})}
		</div>
	);
}
