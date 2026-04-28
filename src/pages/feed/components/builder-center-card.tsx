// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import { useTranslation } from "../../../hooks/useTranslation";

const MAX_TITLE = 45;
const truncate = (s: string) =>
	s.length > MAX_TITLE ? `${s.slice(0, MAX_TITLE)}…` : s;

// "top 4" tumblr-style mini-cards. each card carries a giant numeral on the
// left + title/author block on the right. per-card accent color cycles through
// the cdn palette via .feed-mini-card--n{1..4} modifier classes.
const TOP_FOUR = [
	{
		title: "Can it run DOOM? Playing DOOM in Claude Code with DOOM MCP",
		author: "Gunnar Grosch",
		url: "https://builder.aws.com/content/3AmPDxn7EBkb5DTI9ERcCwPWjqk/can-it-run-doom-playing-doom-in-claude-code-with-doom-mcp",
	},
	{
		title: "Step Functions without ASL? Welcome Lambda Durable Functions",
		author: "Andres Moreno",
		url: "https://builder.aws.com/content/2c0uRhtYh1arjgygZUvxKOspmrw/step-functions-without-asl-welcome-lambda-durable-functions",
	},
	{
		title:
			"Core Concepts of Containers: Technical Intro to Running Software on Containers featuring Amazon ECS Express Mode",
		author: "Bryan Chasko",
		url: "https://builder.aws.com/content/38G26lD5rr5GOqDtjfeo3cO4Z1g/core-concepts-of-containers-technical-intro-to-running-software-on-containers-featuring-amazon-ecs-express-mode",
	},
	{
		title:
			"Applied Technology — Amazon Leo: How AWS Brought Amazon's Project Kuiper to Market",
		author: "Bryan Chasko",
		url: "https://builder.aws.com/content/36fvKToWy99YcAK3sDn34yjS6FE/applied-technology-amazon-leo-how-aws-brought-amazons-project-kuiper-to-market",
	},
];

export default function BuilderCenterCard() {
	const { t } = useTranslation();

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
			<ol className="feed-mini-grid">
				{TOP_FOUR.map((item, i) => (
					<li
						key={item.url}
						className={`feed-mini-card feed-mini-card--n${i + 1}`}
					>
						<a
							href={item.url}
							target="_blank"
							rel="noopener noreferrer"
							className="feed-mini-card__link"
						>
							<span className="feed-mini-card__number" aria-hidden="true">
								{i + 1}
							</span>
							<div className="feed-mini-card__body">
								<span className="feed-mini-card__title">
									{truncate(item.title)}
								</span>
								<span className="feed-mini-card__meta">{item.author}</span>
							</div>
						</a>
					</li>
				))}
			</ol>
		</Container>
	);
}
