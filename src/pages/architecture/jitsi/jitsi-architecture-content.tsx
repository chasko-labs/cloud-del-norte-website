// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import Box from "@cloudscape-design/components/box";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useTranslation } from "../../../hooks/useTranslation";

export default function JitsiArchitectureContent() {
	const { t } = useTranslation();

	return (
		<ContentLayout
			header={<Header variant="h1">{t("jitsiArchitecture.header")}</Header>}
		>
			<SpaceBetween size="l">
				{/* Video Call Architecture */}
				<Container
					header={
						<Header variant="h2">
							{t("jitsiArchitecture.videoCallArch.title")}
						</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">
							{t("jitsiArchitecture.videoCallArch.description")}
						</Box>
						<Table
							columnDefinitions={[
								{
									id: "container",
									header: t("jitsiArchitecture.videoCallArch.containerCol"),
									cell: (item) => item.container,
								},
								{
									id: "role",
									header: t("jitsiArchitecture.videoCallArch.roleCol"),
									cell: (item) => item.role,
								},
							]}
							items={[
								{
									container: "jitsi-web",
									role: t("jitsiArchitecture.videoCallArch.webRole"),
								},
								{
									container: "prosody",
									role: t("jitsiArchitecture.videoCallArch.prosodyRole"),
								},
								{
									container: "jicofo",
									role: t("jitsiArchitecture.videoCallArch.jicofoRole"),
								},
								{
									container: "jvb",
									role: t("jitsiArchitecture.videoCallArch.jvbRole"),
								},
							]}
							variant="embedded"
						/>
						<ColumnLayout columns={2}>
							<SpaceBetween size="xs">
								<Box variant="h4">
									{t("jitsiArchitecture.videoCallArch.scaleToZeroTitle")}
								</Box>
								<Box variant="p">
									{t("jitsiArchitecture.videoCallArch.scaleToZeroDesc")}
								</Box>
							</SpaceBetween>
							<SpaceBetween size="xs">
								<Box variant="h4">
									{t("jitsiArchitecture.videoCallArch.networkTitle")}
								</Box>
								<Box variant="p">
									{t("jitsiArchitecture.videoCallArch.networkDesc")}
								</Box>
							</SpaceBetween>
						</ColumnLayout>
					</SpaceBetween>
				</Container>

				{/* Authentication Flow */}
				<Container
					header={
						<Header variant="h2">
							{t("jitsiArchitecture.authFlow.title")}
						</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">{t("jitsiArchitecture.authFlow.description")}</Box>
						<Box variant="code">{t("jitsiArchitecture.authFlow.diagram")}</Box>
						<Table
							columnDefinitions={[
								{
									id: "claim",
									header: t("jitsiArchitecture.authFlow.claimCol"),
									cell: (item) => item.claim,
								},
								{
									id: "purpose",
									header: t("jitsiArchitecture.authFlow.purposeCol"),
									cell: (item) => item.purpose,
								},
							]}
							items={[
								{
									claim: "room",
									purpose: t("jitsiArchitecture.authFlow.roomClaim"),
								},
								{
									claim: "moderator",
									purpose: t("jitsiArchitecture.authFlow.moderatorClaim"),
								},
								{
									claim: "recording",
									purpose: t("jitsiArchitecture.authFlow.recordingClaim"),
								},
							]}
							variant="embedded"
						/>
					</SpaceBetween>
				</Container>

				{/* Recording Pipeline */}
				<Container
					header={
						<Header variant="h2">
							{t("jitsiArchitecture.recording.title")}
						</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">
							{t("jitsiArchitecture.recording.description")}
						</Box>
						<Box variant="h4">
							{t("jitsiArchitecture.recording.pipelineTitle")}
						</Box>
						<Box variant="code">
							{t("jitsiArchitecture.recording.pipeline")}
						</Box>
						<ColumnLayout columns={2}>
							<SpaceBetween size="xs">
								<Box variant="h4">
									{t("jitsiArchitecture.recording.jibriTitle")}
								</Box>
								<Box variant="p">
									{t("jitsiArchitecture.recording.jibriDesc")}
								</Box>
							</SpaceBetween>
							<SpaceBetween size="xs">
								<Box variant="h4">
									{t("jitsiArchitecture.recording.uploadTitle")}
								</Box>
								<Box variant="p">
									{t("jitsiArchitecture.recording.uploadDesc")}
								</Box>
							</SpaceBetween>
						</ColumnLayout>
					</SpaceBetween>
				</Container>

				{/* Testing with Nova Act */}
				<Container
					header={
						<Header variant="h2">{t("jitsiArchitecture.testing.title")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Box variant="p">{t("jitsiArchitecture.testing.description")}</Box>
						<Box variant="h4">
							{t("jitsiArchitecture.testing.smoketestTitle")}
						</Box>
						<Box variant="code">
							{t("jitsiArchitecture.testing.smoketestFlow")}
						</Box>
						<Box variant="p">
							{t("jitsiArchitecture.testing.assertionNote")}
						</Box>
						<Box variant="h4">
							{t("jitsiArchitecture.testing.deviceFarmTitle")}
						</Box>
						<Box variant="p">
							{t("jitsiArchitecture.testing.deviceFarmDesc")}
						</Box>
					</SpaceBetween>
				</Container>

				{/* Infrastructure */}
				<Container
					header={
						<Header variant="h2">{t("jitsiArchitecture.infra.title")}</Header>
					}
				>
					<SpaceBetween size="m">
						<Table
							columnDefinitions={[
								{
									id: "account",
									header: t("jitsiArchitecture.infra.accountCol"),
									cell: (item) => item.account,
								},
								{
									id: "id",
									header: t("jitsiArchitecture.infra.idCol"),
									cell: (item) => item.id,
								},
								{
									id: "role",
									header: t("jitsiArchitecture.infra.roleCol"),
									cell: (item) => item.role,
								},
							]}
							items={[
								{
									account: t("jitsiArchitecture.infra.computeAccount"),
									id: "170473530355",
									role: t("jitsiArchitecture.infra.computeRole"),
								},
								{
									account: t("jitsiArchitecture.infra.hostingAccount"),
									id: "211125425201",
									role: t("jitsiArchitecture.infra.hostingRole"),
								},
								{
									account: t("jitsiArchitecture.infra.testingAccount"),
									id: "946179428633",
									role: t("jitsiArchitecture.infra.testingRole"),
								},
							]}
							variant="embedded"
						/>
						<ColumnLayout columns={2}>
							<SpaceBetween size="xs">
								<Box variant="h4">
									{t("jitsiArchitecture.infra.monitoringTitle")}
								</Box>
								<Box variant="p">
									{t("jitsiArchitecture.infra.monitoringDesc")}
								</Box>
							</SpaceBetween>
							<SpaceBetween size="xs">
								<Box variant="h4">{t("jitsiArchitecture.infra.costTitle")}</Box>
								<Box variant="p">{t("jitsiArchitecture.infra.costDesc")}</Box>
							</SpaceBetween>
						</ColumnLayout>
						<Box variant="p">
							{t("jitsiArchitecture.infra.opsLink")}{" "}
							<Link
								href="https://github.com/chasko-labs/jitsi-video-hosting"
								external
							>
								chasko-labs/jitsi-video-hosting
							</Link>
						</Box>
					</SpaceBetween>
				</Container>
			</SpaceBetween>
		</ContentLayout>
	);
}
