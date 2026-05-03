// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import HelpPanel from "@cloudscape-design/components/help-panel";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useTranslation } from "../../../hooks/useTranslation";
import "./help-panel.css";
import SidePanelCard, { type SidePanelCardItem } from "./side-panel-card";

// Per-organizer article card stacks rendered under each leader inside the
// "organizer's section" (Group organizers heading). Moved here from
// src/components/navigation in v0.0.0104 — the floating <nav> on the LEFT
// side panel was covering Liora.
//
// "wayne -> arrowhead" is intentionally redundant with the feed's
// ArrowheadNews carousel — Bryan ask: keep it in BOTH places.
const ANDRES_CARDS: SidePanelCardItem[] = [
	{
		title: "Step Functions without ASL? Welcome Lambda Durable Functions",
		author: "Andres Moreno",
		authorBadge: "AWS CB",
		blurb:
			"AWS announced Lambda Durable Functions at re:Invent 2025. Run multi-step workflows with checkpoints and state using familiar code — without Amazon State Language.",
		url: "https://builder.aws.com/content/2c0uRhtYh1arjgygZUvxKOspmrw/step-functions-without-asl-welcome-lambda-durable-functions",
	},
];

const BRYAN_CARDS: SidePanelCardItem[] = [
	{
		title:
			"Core Concepts of Containers: Technical Intro to Running Software on Containers featuring Amazon ECS Express Mode",
		author: "Bryan Chasko",
		authorBadge: "AWS Hero",
		blurb:
			"Hands-on intro to containers — images, runtimes, orchestration — with Amazon ECS Express Mode as the first-deploy path.",
		url: "https://builder.aws.com/content/38G26lD5rr5GOqDtjfeo3cO4Z1g/core-concepts-of-containers-technical-intro-to-running-software-on-containers-featuring-amazon-ecs-express-mode",
	},
	{
		title:
			"Applied Technology — Amazon Leo: How AWS Brought Amazon's Project Kuiper to Market",
		author: "Bryan Chasko",
		authorBadge: "AWS Hero",
		blurb:
			"How Project Kuiper went from R&D to commercial availability under the Amazon Leo brand — applied AWS infrastructure at orbital scale.",
		url: "https://builder.aws.com/content/36fvKToWy99YcAK3sDn34yjS6FE/applied-technology-amazon-leo-how-aws-brought-amazons-project-kuiper-to-market",
	},
];

const WAYNE_CARDS: SidePanelCardItem[] = [
	// Redundant with feed's ArrowheadNews on purpose — Bryan ask.
	{
		title:
			"Arrowhead Center Seeks Design-Build Teams for New Film & TV Soundstage Complex",
		author: "Arrowhead Center",
		blurb:
			"Arrowhead Center Inc. is developing a Film and TV Soundstage Complex at Arrowhead Park and is now accepting proposals from qualified Design-Build teams.",
		url: "https://arrowheadcenter.nmsu.edu/park/Soundstage-DB-RFP.pdf",
	},
];

export const HelpPanelHome = () => {
	const { t } = useTranslation();

	return (
		<HelpPanel header={<h2>{t("helpPanel.userGroupTitle")}</h2>}>
			<SpaceBetween size="l">
				{/* Community description — glass plate so prose anchors over wallpaper */}
				<div className="cdn-glass hp-glass-body">
					<p className="hp-body">{t("helpPanel.communityDescription")}</p>
				</div>

				{/* Volunteer roles — card grid (no heading; flows from "and beyond") */}
				<div>
					<SpaceBetween size="s">
						<div className="hp-role-card">
							<p className="hp-role-card-name">{t("helpPanel.aslLeadRole")}</p>
							<p className="hp-role-card-desc">{t("helpPanel.aslLeadDesc")}</p>
						</div>
						<div className="hp-role-card">
							<p className="hp-role-card-name">{t("helpPanel.lsmLead")}</p>
							<p className="hp-role-card-desc">{t("helpPanel.lsmLeadDesc")}</p>
						</div>
						<div className="hp-role-card">
							<p className="hp-role-card-name">
								{t("helpPanel.spanishSpeakers")}
							</p>
							<p className="hp-role-card-desc">
								{t("helpPanel.spanishSpeakersDesc")}
							</p>
						</div>
						<div className="hp-role-card">
							<p className="hp-role-card-name">
								{t("helpPanel.studentsStepUp")}
							</p>
						</div>
						<div className="hp-role-card">
							<p className="hp-role-card-name">{t("helpPanel.womenWelcome")}</p>
							<p className="hp-role-card-desc">
								{t("helpPanel.womenWelcomeDesc")}
							</p>
						</div>
					</SpaceBetween>
					<p className="hp-body" style={{ marginTop: "12px" }}>
						<Link href="https://www.meetup.com/awsugclouddelnorte/" external>
							{t("helpPanel.reachOutOnMeetup")}
						</Link>
					</p>
				</div>

				<hr className="hp-divider" />

				{/* Group organizers */}
				<div>
					<h3 className="hp-section-heading">
						{t("helpPanel.communityLeaders")}
					</h3>
					<SpaceBetween size="s">
						<div className="hp-leader">
							<p className="hp-leader-name">Andres Moreno</p>
							<p className="hp-leader-role">
								{t("helpPanel.andresMorenoRole")}
							</p>
							<p className="hp-leader-bio">
								{t("helpPanel.andresMorenoBioPrefix")}{" "}
								<Link href="https://andmoredev.medium.com/" external>
									andmoredev.medium.com
								</Link>{" "}
								{t("helpPanel.andresMorenoBioSuffix")}
							</p>
							<div className="hp-social">
								<Link href="https://andmore.dev" external>
									<span className="hp-social-pill hp-social-pill--brand">
										andmore.dev
									</span>
								</Link>
								<Link href="https://x.com/andmoredev" external>
									<span className="hp-social-pill">X @andmoredev</span>
								</Link>
								<Link href="https://github.com/andmoredev" external>
									<span className="hp-social-pill">GitHub</span>
								</Link>
							</div>
							<div className="side-panel-card-stack">
								{ANDRES_CARDS.map((card) => (
									<SidePanelCard key={card.url} item={card} />
								))}
							</div>
						</div>

						<div className="hp-leader">
							<p className="hp-leader-name">Bryan Chasko</p>
							<p className="hp-leader-role">{t("helpPanel.bryanChaskoRole")}</p>
							<div className="hp-social">
								<a
									className="hp-social-pill hp-social-pill--brand"
									href="https://bsky.app/profile/bryanchasko.bsky.social"
									target="_blank"
									rel="noreferrer"
								>
									<span className="hp-social-pill__icon" aria-hidden="true">
										🦋
									</span>
									@bryanchasko.bsky.social
								</a>
								<Link
									href="https://aws.amazon.com/developer/community/heroes/bryan-chasko/"
									external
								>
									<span className="hp-social-pill hp-social-pill--brand">
										AWS Hero
									</span>
								</Link>
								<Link href="https://bryanchasko.com" external>
									<span className="hp-social-pill hp-social-pill--brand">
										bryanchasko.com
									</span>
								</Link>
								<Link href="https://github.com/BryanChasko" external>
									<span className="hp-social-pill">GitHub</span>
								</Link>
							</div>
							<div className="side-panel-card-stack">
								{BRYAN_CARDS.map((card) => (
									<SidePanelCard key={card.url} item={card} />
								))}
							</div>
						</div>

						<div className="hp-leader">
							<p className="hp-leader-name">Jacob Wright</p>
							<p className="hp-leader-role">{t("helpPanel.jacobWrightRole")}</p>
							<p className="hp-leader-bio">{t("helpPanel.jacobWrightBio")}</p>
							<div className="hp-social">
								<Link href="https://www.linkedin.com/in/jrwright121" external>
									<span className="hp-social-pill">LinkedIn</span>
								</Link>
							</div>
						</div>
					</SpaceBetween>
				</div>

				<hr className="hp-divider" />

				{/* Hall of Fame */}
				<div>
					<h3 className="hp-section-heading">
						{t("helpPanel.hallOfFameHeader")}
					</h3>
					<div className="hp-leader hp-leader--memorial">
						<p className="hp-leader-name">Wayne Savage</p>
						<p className="hp-leader-role">{t("helpPanel.wayneSavageRole")}</p>
						<p className="hp-leader-bio">
							{t("helpPanel.wayneSavageBioPrefix")}{" "}
							<Link href="https://arrowheadcenter.nmsu.edu/" external>
								{t("helpPanel.arrowheadPark")}
							</Link>
							{t("helpPanel.wayneSavageBioMiddle")}{" "}
							<Link
								href="https://www.lascrucesbulletin.com/stories/arrowhead-studios-15-million-project-breaks-ground,136925"
								external
							>
								{t("helpPanel.arrowheadSoundstage")}
							</Link>{" "}
							{t("helpPanel.wayneSavageBioSuffix")}
						</p>
						<div className="side-panel-card-stack">
							{WAYNE_CARDS.map((card) => (
								<SidePanelCard key={card.url} item={card} />
							))}
						</div>
					</div>
				</div>

				<hr className="hp-divider" />

				{/* Global community — glass plate with cool sapphire echo
				    of Liora's stickynote-2 visitor flag */}
				<div className="cdn-glass hp-glass-body hp-glass-body--global">
					<h4 className="hp-sub-heading">
						{t("helpPanel.globalCommunityHeader")}
					</h4>
					<Link
						href="https://www.meetup.com/pro/global-aws-user-group-community/"
						external
					>
						{t("helpPanel.findLocalGroup")}
					</Link>
				</div>
			</SpaceBetween>
		</HelpPanel>
	);
};
