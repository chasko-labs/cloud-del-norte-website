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

const MAX_TITLE = 65;
const truncate = (s: string) =>
	s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE)}…` : s;

// hover auto-advance: scroll the carousel one card to the right every
// CAROUSEL_ADVANCE_MS while the pointer is over the section. Pause on
// click / touch / pointerdown so a user can read without the deck moving
// out from under them. prefers-reduced-motion suppresses the timer
// entirely (no auto-advance, no smooth scroll).
const CAROUSEL_ADVANCE_MS = 3000;

function CardItem({ card, n }: { card: Card; n: number }) {
	const badge = badgeForAuthor(card.author);
	return (
		<li
			className={`feed-mini-card feed-mini-card--n${n}`}
			data-author={card.author}
		>
			<a
				href={card.url}
				target="_blank"
				rel="noopener noreferrer"
				className="feed-mini-card__link"
			>
				<span className="feed-mini-card__number" aria-hidden="true">
					{n}
				</span>
				<div className="feed-mini-card__body">
					<span className="feed-mini-card__title">{truncate(card.title)}</span>
					<span className="feed-mini-card__meta">
						<span className="feed-mini-card__author">{card.author}</span>
						{badge && <BuilderBadge badge={badge} />}
						{card.sub && (
							<span className="feed-mini-card__sub">{card.sub}</span>
						)}
					</span>
					<span className="feed-mini-card__blurb">{card.blurb}</span>
				</div>
			</a>
		</li>
	);
}

export default function BuilderCenterCard() {
	const { t, locale } = useTranslation();
	const deck = useMemo(() => deckForLocale(locale), [locale]);
	const carouselRef = useRef<HTMLOListElement>(null);
	const [paused, setPaused] = useState(false);
	const [hovering, setHovering] = useState(false);

	// honor prefers-reduced-motion — kill auto-advance entirely. Reads the
	// match once on mount; subscribers re-evaluate on media query change.
	const [reducedMotion, setReducedMotion] = useState(false);
	useEffect(() => {
		if (typeof window === "undefined" || !window.matchMedia) return;
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		setReducedMotion(mq.matches);
		const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const advance = useCallback(() => {
		const el = carouselRef.current;
		if (!el) return;
		// step = average card width; falls back to el.clientWidth if the
		// rendered children haven't sized yet (e.g. font load race).
		const first = el.querySelector<HTMLElement>(".feed-mini-card");
		const step = first
			? first.getBoundingClientRect().width + 12
			: el.clientWidth;
		const maxScroll = el.scrollWidth - el.clientWidth;
		const next = el.scrollLeft + step;
		el.scrollTo({
			left: next > maxScroll - 4 ? 0 : next,
			behavior: reducedMotion ? "auto" : "smooth",
		});
	}, [reducedMotion]);

	useEffect(() => {
		if (!hovering || paused || reducedMotion) return;
		if (deck.carousel.length === 0) return;
		const id = setInterval(advance, CAROUSEL_ADVANCE_MS);
		return () => clearInterval(id);
	}, [hovering, paused, reducedMotion, deck.carousel.length, advance]);

	const allCards = useMemo(() => [...deck.primary, ...deck.carousel], [deck]);

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
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover/touch handlers are pure presentation — they only auto-scroll the carousel for sighted/pointer users; the links inside remain fully keyboard- and screen-reader-accessible without these handlers */}
			<div
				className="feed-builder-deck"
				onMouseEnter={() => setHovering(true)}
				onMouseLeave={() => {
					setHovering(false);
					setPaused(false);
				}}
				onPointerDown={() => setPaused(true)}
				onTouchStart={() => setPaused(true)}
			>
				<ol
					ref={carouselRef}
					className="feed-mini-grid feed-mini-grid--scroll"
					aria-label={t("feedPage.builderCenterHeader")}
				>
					{allCards.map((card, i) => (
						<CardItem key={card.url} card={card} n={i + 1} />
					))}
				</ol>
			</div>
		</Container>
	);
}
