// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import BuilderBadge from "./builder-badge";
import {
	badgeForAuthor,
	type BuilderCenterCard as Card,
	deckForLocale,
} from "./builder-center-data";

const MAX_TITLE = 90; // 2-line clamp handles wrap; this caps absurd outliers
const truncate = (s: string) =>
	s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE)}…` : s;

const VISIBLE = 4;
const AUTO_ADVANCE_MS = 7000;

// v0.0.0105 — bryan: "rethink the builder section a bit - stick to showing 4
// at a time with ability to rotate through the article cards to see the
// rest". Window of 4 cards, prev/next chevrons + auto-advance every Ns,
// wrap-around at the end so the last window borrows the first card(s).
// prefers-reduced-motion: kills auto-advance + the fade animation (instant
// swap). Each card shows: rank #, 2-line title clamp, author, badge.
// Drops blurb + sub.

interface VisibleCard extends Card {
	rank: number; // 1..N visible rank stays stable per source-array index
}

function CardItem({ card }: { card: VisibleCard }) {
	const badge = badgeForAuthor(card.author);
	const n = card.rank;
	return (
		<li
			className={`feed-mini-card feed-mini-card--n${((n - 1) % 4) + 1}`}
			data-author={card.author}
		>
			<a
				href={card.url}
				target="_blank"
				rel="noopener noreferrer"
				className="feed-mini-card__link"
			>
				<span className="feed-mini-card__rank" aria-hidden="true">
					#{n}
				</span>
				<div className="feed-mini-card__body">
					<span className="feed-mini-card__title">{truncate(card.title)}</span>
					<span className="feed-mini-card__meta">
						<span className="feed-mini-card__author">{card.author}</span>
						{badge && <BuilderBadge badge={badge} />}
					</span>
				</div>
			</a>
		</li>
	);
}

export default function BuilderCenterCard() {
	const { t, locale } = useTranslation();
	const deck = useMemo(() => deckForLocale(locale), [locale]);
	const total = deck.cards.length;

	// honor prefers-reduced-motion — kill auto-advance + transition.
	const [reducedMotion, setReducedMotion] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReducedMotion(mq.matches);
		const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	// `start` is the index into deck.cards of the first card in the visible
	// window. Window steps by VISIBLE; wraps modulo total. Pause auto-advance
	// when the user hovers OR has interacted via chevrons (so reading isn't
	// hijacked).
	const [start, setStart] = useState(0);
	const [paused, setPaused] = useState(false);
	const interactedRef = useRef(false);

	const step = useCallback(
		(dir: 1 | -1) => {
			if (total <= VISIBLE) return;
			setStart((s) => {
				const next = (s + dir * VISIBLE + total) % total;
				return next;
			});
		},
		[total],
	);

	const next = useCallback(() => step(1), [step]);
	const prev = useCallback(() => step(-1), [step]);

	useEffect(() => {
		if (reducedMotion || paused || interactedRef.current) return;
		if (total <= VISIBLE) return;
		const id = setInterval(() => {
			setStart((s) => (s + VISIBLE) % total);
		}, AUTO_ADVANCE_MS);
		return () => clearInterval(id);
	}, [reducedMotion, paused, total]);

	// Build visible window with wrap-around. Each entry carries a stable
	// rank (1..total) tied to the underlying deck index so the # stays
	// associated with the article, not the window slot.
	const visible = useMemo<VisibleCard[]>(() => {
		const out: VisibleCard[] = [];
		const take = Math.min(VISIBLE, total);
		for (let i = 0; i < take; i++) {
			const idx = (start + i) % total;
			out.push({ ...deck.cards[idx], rank: idx + 1 });
		}
		return out;
	}, [deck.cards, start, total]);

	const canRotate = total > VISIBLE;
	const windowCount = canRotate ? Math.ceil(total / VISIBLE) : 1;
	const windowIndex = canRotate ? Math.floor(start / VISIBLE) % windowCount : 0;

	const handleUserStep = (dir: 1 | -1) => {
		interactedRef.current = true;
		step(dir);
	};

	return (
		<Container
			header={
				<Header
					variant="h2"
					actions={
						<Link href="https://builder.aws.com/" external fontSize="body-s">
							{t("feedPage.builderCenterOpen")}
						</Link>
					}
				>
					{t("feedPage.builderCenterHeader")}
				</Header>
			}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: pointer handlers only pause auto-advance — keyboard / SR users use the chevron buttons below */}
			<div
				className="feed-builder-deck"
				onMouseEnter={() => setPaused(true)}
				onMouseLeave={() => setPaused(false)}
			>
				<ol
					// key forces remount per window so the fade-in animation re-runs
					key={`window-${windowIndex}`}
					className="feed-mini-grid feed-mini-grid--window"
					aria-label={t("feedPage.builderCenterHeader")}
					aria-live="polite"
				>
					{visible.map((card) => (
						<CardItem key={card.url} card={card} />
					))}
				</ol>

				{canRotate && (
					<div
						className="feed-builder-deck__controls"
						role="group"
						aria-label={t("feedPage.builderCenterHeader")}
					>
						<button
							type="button"
							className="feed-builder-deck__chev"
							onClick={() => handleUserStep(-1)}
							aria-label={t("feedPage.previousArticle")}
						>
							‹
						</button>
						<span
							className="feed-builder-deck__counter"
							aria-hidden="true"
						>{`${windowIndex + 1} / ${windowCount}`}</span>
						<button
							type="button"
							className="feed-builder-deck__chev"
							onClick={() => handleUserStep(1)}
							aria-label={t("feedPage.nextArticle")}
						>
							›
						</button>
					</div>
				)}
			</div>
		</Container>
	);
}
