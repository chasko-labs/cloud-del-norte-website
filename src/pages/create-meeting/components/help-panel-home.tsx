// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import HelpPanel from "@cloudscape-design/components/help-panel";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useTranslation } from "../../../hooks/useTranslation";
import "./help-panel.css";

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
									<span className="hp-social-pill">andmore.dev</span>
								</Link>
								<Link href="https://x.com/andmoredev" external>
									<span className="hp-social-pill">X @andmoredev</span>
								</Link>
								<Link href="https://github.com/andmoredev" external>
									<span className="hp-social-pill">GitHub</span>
								</Link>
							</div>
						</div>

						<div className="hp-leader">
							<p className="hp-leader-name">Bryan Chasko</p>
							<p className="hp-leader-role">{t("helpPanel.bryanChaskoRole")}</p>
							<div className="hp-social">
								<Link
									href="https://aws.amazon.com/developer/community/heroes/bryan-chasko/"
									external
								>
									<span className="hp-social-pill">AWS Hero</span>
								</Link>
								<Link href="https://bryanchasko.com" external>
									<span className="hp-social-pill">bryanchasko.com</span>
								</Link>
								<Link href="https://github.com/BryanChasko" external>
									<span className="hp-social-pill">GitHub</span>
								</Link>
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
					<div className="hp-leader">
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
					</div>
				</div>

				<hr className="hp-divider" />

				{/* Global community — glass plate */}
				<div className="cdn-glass hp-glass-body">
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
