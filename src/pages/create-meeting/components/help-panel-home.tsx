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
				{/* Community description */}
				<div>
					<p className="hp-body">{t("helpPanel.communityDescription")}</p>
				</div>

				<hr className="hp-divider" />

				{/* Organizers wanted */}
				<div>
					<h3 className="hp-section-heading">
						{t("helpPanel.organizersWantedHeader")}
					</h3>
					<ul className="hp-role-list">
						<li>
							<strong>{t("helpPanel.aslLeadRole")}</strong> —{" "}
							{t("helpPanel.aslLeadDesc")}
						</li>
						<li>
							<strong>LSM Lead</strong> — {t("helpPanel.lsmLeadDesc")}
						</li>
						<li>{t("helpPanel.spanishSpeakers")}</li>
						<li>{t("helpPanel.studentsStepUp")}</li>
						<li>{t("helpPanel.womenWelcome")}</li>
					</ul>
					<p className="hp-body" style={{ marginTop: "12px" }}>
						<Link href="https://www.meetup.com/awsugclouddelnorte/" external>
							{t("helpPanel.reachOutOnMeetup")}
						</Link>
					</p>
				</div>

				<hr className="hp-divider" />

				{/* Community leaders */}
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

						<div className="hp-leader">
							<p className="hp-leader-name">Wayne Savage</p>
							<p className="hp-leader-role">{t("helpPanel.wayneSavageRole")}</p>
							<p className="hp-leader-bio">
								{t("helpPanel.wayneSavageBioPrefix")}{" "}
								<Link href="https://arrowheadcenter.nmsu.edu/" external>
									{t("helpPanel.arrowheadPark")}
								</Link>{" "}
								{t("helpPanel.wayneSavageBioSuffix")}
							</p>
						</div>
					</SpaceBetween>
				</div>

				<hr className="hp-divider" />

				{/* Global community */}
				<div>
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
