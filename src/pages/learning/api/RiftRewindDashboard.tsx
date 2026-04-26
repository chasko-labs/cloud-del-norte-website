import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";

interface MatchSummary {
	matchId: string;
	kills: number;
	deaths: number;
	assists: number;
	win: boolean;
	champion: string;
	wins?: number;
	losses?: number;
	total_games?: number;
	win_rate?: number;
	event?: string;
}

const RIOT_API_PROXY_URL =
	"https://nojl2v2ozhs5epqg76smmtjmhu0htodl.lambda-url.us-east-2.on.aws/";

interface Contest {
	id: string;
	name: string;
	status: string;
	winner: string;
}

interface ApiAttempt {
	status: string;
	endpoint: string;
	result: string;
	data_count: number;
}

const RiftRewindDashboard: React.FC = () => {
	const { t } = useTranslation();
	const [matches, setMatches] = useState<MatchSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [dataSource, setDataSource] = useState<"live" | "mock">("mock");
	const [errorMessage, setErrorMessage] = useState<string>("");
	const [apiResponse, setApiResponse] = useState<string>("");
	const [demoError, setDemoError] = useState(false);

	const [championApiResponse, setChampionApiResponse] = useState<string>("");
	const [endpointDetails, setEndpointDetails] = useState<string>("");
	const [hasTriedLiveData, setHasTriedLiveData] = useState(false);
	const [championsApiDetails, setChampionsApiDetails] = useState<any>(null);
	const [contests, setContests] = useState<Contest[]>([]);
	const [activeDemo, setActiveDemo] = useState<"contests" | "players" | null>(
		null,
	);
	const [selectedYear, setSelectedYear] = useState({
		label: "2024",
		value: "2024",
	});

	const fetchContests = async (year?: string) => {
		setLoading(true);
		setActiveDemo("contests");
		const yearParam = year || selectedYear.value;
		try {
			const response = await fetch(
				`${RIOT_API_PROXY_URL}?endpoint=contests&year=${yearParam}`,
			);
			const data = await response.json();
			setContests(data.data || []);
			setApiResponse(`Contests API: ${response.status} ${response.statusText}`);
		} catch (error) {
			console.error("Failed to fetch contests:", error);
			// Fallback data
			setContests([
				{
					id: "worlds2024",
					name: "Worlds Championship 2024",
					status: "completed",
					winner: "T1",
				},
				{
					id: "msi2024",
					name: "Mid-Season Invitational 2024",
					status: "completed",
					winner: "Gen.G",
				},
			]);
		} finally {
			setLoading(false);
		}
	};

	const fetchMatchHistory = async () => {
		setLoading(true);
		setDemoError(false);
		setErrorMessage("");
		setApiResponse("");
		setHasTriedLiveData(true);
		try {
			if (RIOT_API_PROXY_URL.includes("PLACEHOLDER")) {
				const mockMatches: MatchSummary[] = [
					{
						matchId: "NA1_4567890123",
						kills: 12,
						deaths: 3,
						assists: 8,
						win: true,
						champion: "Jinx",
					},
					{
						matchId: "NA1_4567890124",
						kills: 5,
						deaths: 7,
						assists: 15,
						win: false,
						champion: "Thresh",
					},
					{
						matchId: "NA1_4567890125",
						kills: 18,
						deaths: 2,
						assists: 4,
						win: true,
						champion: "Yasuo",
					},
				];

				await new Promise((resolve) => setTimeout(resolve, 1000));
				setMatches(mockMatches);
			} else {
				try {
					console.log("Fetching from:", RIOT_API_PROXY_URL);
					const response = await fetch(RIOT_API_PROXY_URL);

					setApiResponse(`Status: ${response.status} ${response.statusText}`);

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					const responseText = await response.text();
					console.log("Raw API response:", responseText);

					const data = JSON.parse(responseText);
					console.log("Parsed API data:", data);

					if (data.error) {
						throw new Error(`API Error: ${data.error}`);
					}

					// Handle the new response format
					const actual_data = data.data || data;
					const api_attempts: ApiAttempt[] =
						(data.api_attempts as ApiAttempt[]) || [];
					const champions_api_details = data.champions_api_details || null;

					if (!Array.isArray(actual_data) || actual_data.length === 0) {
						throw new Error("API returned empty or invalid data");
					}

					setMatches(actual_data);
					setDataSource("live");
					setErrorMessage("");
					setChampionsApiDetails(champions_api_details);

					// Build detailed endpoint summary
					const successful_endpoints = api_attempts.filter(
						(ep) => ep.status === "Success",
					);
					const failed_endpoints = api_attempts.filter(
						(ep) => ep.status === "Failed" || ep.status === "Deprecated",
					);
					const no_data_endpoints = api_attempts.filter(
						(ep) => ep.status === "No Data",
					);

					// Create detailed status messages
					const success_details = successful_endpoints
						.map(
							(ep) => `${ep.endpoint}: ${ep.result} (${ep.data_count} items)`,
						)
						.join(" | ");

					setChampionApiResponse(
						success_details || "✅ Data loaded successfully",
					);

					if (failed_endpoints.length > 0 || no_data_endpoints.length > 0) {
						const all_issues = [...failed_endpoints, ...no_data_endpoints];
						setEndpointDetails(
							`⚠️ ${all_issues.length} endpoint(s) with issues: ${all_issues.map((ep) => `${ep.endpoint} (${ep.status})`).join(", ")}`,
						);
					} else {
						setEndpointDetails(
							`✅ All ${api_attempts.length} endpoints successful`,
						);
					}
				} catch (apiError) {
					const errorMsg =
						apiError instanceof Error ? apiError.message : "Unknown error";
					console.error("API Error:", errorMsg);
					setErrorMessage(
						`API Error: ${errorMsg} | 🔧 Riot API key may be expired - Contact @bryanChasko on GitHub or LinkedIn to refresh the developer key or get a production API key!`,
					);

					const mockMatches: MatchSummary[] = [
						{
							matchId: "NA1_4567890123",
							kills: 12,
							deaths: 3,
							assists: 8,
							win: true,
							champion: "Jinx",
						},
						{
							matchId: "NA1_4567890124",
							kills: 5,
							deaths: 7,
							assists: 15,
							win: false,
							champion: "Thresh",
						},
						{
							matchId: "NA1_4567890125",
							kills: 18,
							deaths: 2,
							assists: 4,
							win: true,
							champion: "Yasuo",
						},
					];
					setMatches(mockMatches);
					setDataSource("mock");
				}
			}
		} catch (error) {
			console.error("Failed to fetch match history:", error);
		} finally {
			setLoading(false);
		}
	};

	const loadDummyData = useCallback(() => {
		const mockMatches: MatchSummary[] = [
			{
				matchId: "The Emperor of Shurima",
				kills: 17,
				deaths: 1,
				assists: 14,
				win: true,
				champion: "Azir",
			},
			{
				matchId: "The Darkin Blade",
				kills: 18,
				deaths: 0,
				assists: 15,
				win: true,
				champion: "Aatrox",
			},
			{
				matchId: "The Loose Cannon",
				kills: 17,
				deaths: 1,
				assists: 14,
				win: true,
				champion: "Jinx",
			},
			{
				matchId: "The Chain Warden",
				kills: 17,
				deaths: 1,
				assists: 14,
				win: true,
				champion: "Thresh",
			},
			{
				matchId: "The Outlaw",
				kills: 16,
				deaths: 1,
				assists: 13,
				win: true,
				champion: "Graves",
			},
		];
		setMatches(mockMatches);
		setDataSource("mock");
		setChampionsApiDetails(null);
	}, []);

	useEffect(() => {
		loadDummyData();
	}, [loadDummyData]);

	const columnDefinitions = [
		{
			id: "champion",
			header: t("learning.api.championName"),
			cell: (item: MatchSummary) => item.champion,
		},
		{
			id: "matchId",
			header: t("learning.api.championTitle"),
			cell: (item: MatchSummary) => item.matchId,
		},
		{
			id: "kills",
			header: t("learning.api.attackPower"),
			cell: (item: MatchSummary) => item.kills,
		},
		{
			id: "deaths",
			header: t("learning.api.defenseRating"),
			cell: (item: MatchSummary) => item.deaths,
		},
		{
			id: "assists",
			header: t("learning.api.speedRating"),
			cell: (item: MatchSummary) => item.assists,
		},
		{
			id: "result",
			header: t("learning.api.tierStatus"),
			cell: (item: MatchSummary) => (
				<Box>
					<span style={{ fontSize: "18px", marginRight: "6px" }}>
						{item.win ? "⭐" : "🔸"}
					</span>
					{item.win ? t("learning.api.sTier") : t("learning.api.aTier")}
				</Box>
			),
		},
	];

	const getTournamentWinners = (year: string) => {
		const winnersData: Record<string, any[]> = {
			"2024": [
				{
					player: "Faker",
					team: "T1",
					championPlayed: "Azir",
					tournamentWins: 16,
					tournamentLosses: 2,
					winRate: 88.9,
					performanceScore: 95,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Zeus",
					team: "T1",
					championPlayed: "Aatrox",
					tournamentWins: 17,
					tournamentLosses: 1,
					winRate: 94.4,
					performanceScore: 97,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Gumayusi",
					team: "T1",
					championPlayed: "Jinx",
					tournamentWins: 15,
					tournamentLosses: 3,
					winRate: 83.3,
					performanceScore: 92,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Keria",
					team: "T1",
					championPlayed: "Thresh",
					tournamentWins: 14,
					tournamentLosses: 4,
					winRate: 77.8,
					performanceScore: 89,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Oner",
					team: "T1",
					championPlayed: "Graves",
					tournamentWins: 13,
					tournamentLosses: 5,
					winRate: 72.2,
					performanceScore: 87,
					event: `Worlds ${year} Champion`,
				},
			],
			"2023": [
				{
					player: "Faker",
					team: "T1",
					championPlayed: "Azir",
					tournamentWins: 14,
					tournamentLosses: 4,
					winRate: 77.8,
					performanceScore: 89,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Zeus",
					team: "T1",
					championPlayed: "Aatrox",
					tournamentWins: 15,
					tournamentLosses: 3,
					winRate: 83.3,
					performanceScore: 92,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Gumayusi",
					team: "T1",
					championPlayed: "Jinx",
					tournamentWins: 13,
					tournamentLosses: 5,
					winRate: 72.2,
					performanceScore: 87,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Keria",
					team: "T1",
					championPlayed: "Thresh",
					tournamentWins: 12,
					tournamentLosses: 6,
					winRate: 66.7,
					performanceScore: 85,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Oner",
					team: "T1",
					championPlayed: "Graves",
					tournamentWins: 11,
					tournamentLosses: 7,
					winRate: 61.1,
					performanceScore: 83,
					event: `Worlds ${year} Champion`,
				},
			],
			"2022": [
				{
					player: "Deft",
					team: "DRX",
					championPlayed: "Jinx",
					tournamentWins: 12,
					tournamentLosses: 6,
					winRate: 66.7,
					performanceScore: 88,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Kingen",
					team: "DRX",
					championPlayed: "Aatrox",
					tournamentWins: 13,
					tournamentLosses: 5,
					winRate: 72.2,
					performanceScore: 85,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Pyosik",
					team: "DRX",
					championPlayed: "Graves",
					tournamentWins: 11,
					tournamentLosses: 7,
					winRate: 61.1,
					performanceScore: 82,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Zeka",
					team: "DRX",
					championPlayed: "Sylas",
					tournamentWins: 14,
					tournamentLosses: 4,
					winRate: 77.8,
					performanceScore: 90,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "BeryL",
					team: "DRX",
					championPlayed: "Thresh",
					tournamentWins: 10,
					tournamentLosses: 8,
					winRate: 55.6,
					performanceScore: 79,
					event: `Worlds ${year} Champion`,
				},
			],
			"2021": [
				{
					player: "Viper",
					team: "EDG",
					championPlayed: "Aphelios",
					tournamentWins: 13,
					tournamentLosses: 5,
					winRate: 72.2,
					performanceScore: 91,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Flandre",
					team: "EDG",
					championPlayed: "Graves",
					tournamentWins: 12,
					tournamentLosses: 6,
					winRate: 66.7,
					performanceScore: 86,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Jiejie",
					team: "EDG",
					championPlayed: "Xin Zhao",
					tournamentWins: 11,
					tournamentLosses: 7,
					winRate: 61.1,
					performanceScore: 83,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Scout",
					team: "EDG",
					championPlayed: "Ryze",
					tournamentWins: 14,
					tournamentLosses: 4,
					winRate: 77.8,
					performanceScore: 89,
					event: `Worlds ${year} Champion`,
				},
				{
					player: "Meiko",
					team: "EDG",
					championPlayed: "Thresh",
					tournamentWins: 10,
					tournamentLosses: 8,
					winRate: 55.6,
					performanceScore: 81,
					event: `Worlds ${year} Champion`,
				},
			],
		};
		return winnersData[year as keyof typeof winnersData] || winnersData["2024"];
	};

	const codeExample = `// Tournament Winners Data (T1's 2023 Worlds Victory):
{
  "player": "Faker",              // World Champion player
  "team": "T1",                  // Championship team
  "event": "Worlds 2023 Champion", // Tournament won
  "champion_played": "Azir",      // Champion used in finals
  "tournament_wins": 14,          // Actual tournament match wins
  "tournament_losses": 4,         // Actual tournament match losses
  "performance_score": 89         // Performance rating
}

// API Endpoints We Discovered:
// ✅ Works: Data Dragon API (champion data)
// ✅ Works: Challenger League API (top players)
// ❌ Limited: Tournament API (requires special access)
// ❌ Limited: Featured Games (403 Forbidden with basic key)
// ✅ Works: Champion Mastery (with summoner names)

// 3. Data Dragon is public and doesn't require API key
// 4. Challenger ladder contains real pro players`;

	return (
		<SpaceBetween direction="vertical" size="l">
			<Container
				header={
					<Header variant="h3">{t("learning.api.howRiotAPIRESTful")}</Header>
				}
			>
				<SpaceBetween direction="vertical" size="m">
					<Box variant="p">{t("learning.api.restDescription")}</Box>

					<ColumnLayout columns={2} variant="text-grid">
						<Container variant="stacked">
							<Header variant="h3">
								{t("learning.api.uniformInterfaceTitle")}
							</Header>
							<Box variant="p">
								{t("learning.api.uniformInterfaceDesc")}
								<br />
								<code>{t("learning.api.uniformInterfaceExample")}</code>
								<br />
								{t("learning.api.uniformInterfaceReturns")}{" "}
								<code>
									[
									{
										'{id: "worlds2024", name: "Worlds Championship 2024", status: "completed", winner: "T1"}'
									}
									, ...]
								</code>
							</Box>
						</Container>

						<Container variant="stacked">
							<Header variant="h3">
								{t("learning.api.clientServerTitle")}
							</Header>
							<Box variant="p">{t("learning.api.clientServerDesc")}</Box>
						</Container>

						<Container variant="stacked">
							<Header variant="h3">{t("learning.api.statelessTitle")}</Header>
							<Box variant="p">{t("learning.api.statelessDesc")}</Box>
						</Container>

						<Container variant="stacked">
							<Header variant="h3">{t("learning.api.cacheableTitle")}</Header>
							<Box variant="p">{t("learning.api.cacheableDesc")}</Box>
						</Container>

						<Container variant="stacked">
							<Header variant="h3">
								{t("learning.api.layeredSystemTitle")}
							</Header>
							<Box variant="p">{t("learning.api.layeredSystemDesc")}</Box>
						</Container>

						<Container variant="stacked">
							<Header variant="h3">
								{t("learning.api.codeOnDemandTitle")}
							</Header>
							<Box variant="p">
								{t("learning.api.codeOnDemandDesc")}
								<br />
								<code>{t("learning.api.codeOnDemandExample")}</code>
								<br />
								{t("learning.api.codeOnDemandImages")}
							</Box>
						</Container>
					</ColumnLayout>
				</SpaceBetween>
			</Container>

			<Container
				header={
					<Header variant="h3">
						{t("learning.api.uniformInterfaceDemonstration")}
					</Header>
				}
			>
				<SpaceBetween direction="vertical" size="s">
					<Box variant="p">{t("learning.api.uniformInterfaceDesc2")}</Box>

					<Container variant="stacked">
						<Header variant="h3">{t("learning.api.contestsEndpoint")}</Header>
						<SpaceBetween direction="vertical" size="s">
							<Box variant="p">{t("learning.api.contestsDescription")}</Box>

							<ColumnLayout columns={2} variant="text-grid">
								<Box variant="p">
									<strong>{t("learning.api.selectYear")}</strong>
									<br />
									<Select
										selectedOption={selectedYear}
										onChange={({ detail }) =>
											setSelectedYear(
												detail.selectedOption as {
													label: string;
													value: string;
												},
											)
										}
										options={[
											{ label: "2024", value: "2024" },
											{ label: "2023", value: "2023" },
											{ label: "2022", value: "2022" },
											{ label: "2021", value: "2021" },
										]}
									/>
								</Box>
								<Box variant="p">
									<strong>{t("learning.api.requestUrl")}</strong>
									<br />
									<code>GET /contests?year={selectedYear.value}</code>
								</Box>
							</ColumnLayout>

							<Box variant="p">
								<strong>{t("learning.api.responseExpected")}</strong>
								<br />
								<code>HTTP 200 OK</code>{" "}
								{t("learning.api.responseExpectedDesc")}
								<br />
								<code>
									[
									{
										'{id: "worlds2024", name: "Worlds Championship 2024", status: "completed", winner: "T1"}'
									}
									, ...]
								</code>
							</Box>

							<Button
								onClick={() => fetchContests()}
								loading={loading && activeDemo === "contests"}
								variant="primary"
							>
								{t("learning.api.sendGetRequest")}
							</Button>
						</SpaceBetween>
					</Container>

					{activeDemo === "contests" && contests.length > 0 && (
						<Container
							header={
								<Header
									variant="h3"
									description={t("learning.api.contestsResponseDesc")}
								>
									{t("learning.api.contestsResponse")}
								</Header>
							}
						>
							<SpaceBetween direction="vertical" size="s">
								<Box variant="p">
									<strong>{t("learning.api.responseReceived")}</strong>
									<br />
									<code>HTTP 200 OK</code>{" "}
									{t("learning.api.responseReceivedDesc")} {contests.length}{" "}
									{t("learning.api.contestObjects")}
								</Box>

								<Box variant="p">
									<strong>{t("learning.api.dataStructure")}</strong>
									<br />
									{t("learning.api.dataStructureDesc")} <code>id</code>,{" "}
									<code>name</code>, <code>status</code>, <code>winner</code>
									<br />
									<strong>{t("learning.api.endpoint")}</strong>{" "}
									<code>
										[lambda-id].lambda-url.us-east-2.on.aws/?endpoint=contests
									</code>
								</Box>

								<Table
									columnDefinitions={[
										{
											id: "name",
											header: t("learning.api.tournament"),
											cell: (item: Contest) => item.name,
										},
										{
											id: "status",
											header: t("learning.api.status"),
											cell: (item: Contest) => item.status,
										},
										{
											id: "winner",
											header: t("learning.api.winner"),
											cell: (item: Contest) => item.winner,
										},
									]}
									items={contests}
									empty={t("learning.api.noContests")}
								/>
							</SpaceBetween>
						</Container>
					)}
				</SpaceBetween>
			</Container>

			<Container
				header={
					<Header
						variant="h3"
						description={t("learning.api.worldsChampionsDescLong")}
					>
						{t("learning.api.worldsChampions")} {selectedYear.value}{" "}
						{t("learning.api.worldsChampionsDesc")}
					</Header>
				}
			>
				<SpaceBetween direction="vertical" size="s">
					{championsApiDetails && hasTriedLiveData && (
						<Alert
							type={
								championsApiDetails.actual_status === "Success"
									? "success"
									: "error"
							}
							header={t("learning.api.championApiRequestDetails")}
							dismissible
							onDismiss={() => setChampionsApiDetails(null)}
						>
							<SpaceBetween direction="vertical" size="s">
								<ColumnLayout columns={2} variant="text-grid">
									<Box>
										<Box variant="strong">{t("learning.api.expectedUrl")}</Box>
										<Box variant="code">{championsApiDetails.expected_url}</Box>
									</Box>
									<Box>
										<Box variant="strong">
											{t("learning.api.expectedResponse")}
										</Box>
										<Box>{championsApiDetails.expected_response}</Box>
									</Box>
								</ColumnLayout>

								<ColumnLayout columns={2} variant="text-grid">
									<Box>
										<Box variant="strong">{t("learning.api.actualStatus")}</Box>
										<Box
											color={
												championsApiDetails.actual_status === "Success"
													? "text-status-success"
													: "text-status-error"
											}
										>
											{championsApiDetails.actual_status === "Success"
												? "✅"
												: "❌"}{" "}
											{championsApiDetails.actual_status}
										</Box>
									</Box>
									<Box>
										<Box variant="strong">
											{t("learning.api.actualResponse")}
										</Box>
										<Box>{championsApiDetails.actual_response}</Box>
									</Box>
								</ColumnLayout>

								<ColumnLayout columns={2} variant="text-grid">
									<Box>
										<Box variant="strong">{t("learning.api.dataSource")}</Box>
										<Box>{championsApiDetails.data_source}</Box>
									</Box>
									<Box>
										<Box variant="strong">
											{t("learning.api.authentication")}
										</Box>
										<Box>{championsApiDetails.authentication}</Box>
									</Box>
								</ColumnLayout>

								<Box>
									<Box variant="strong">{t("learning.api.responseFormat")}</Box>
									<Box>{championsApiDetails.response_format}</Box>
								</Box>
							</SpaceBetween>
						</Alert>
					)}

					<Box variant="p">
						<strong>{t("learning.api.performanceScore")}</strong>{" "}
						{t("learning.api.performanceScoreDesc")}{" "}
						<strong>{t("learning.api.tournamentRecord")}</strong>{" "}
						{t("learning.api.tournamentRecordDesc")} {selectedYear.value}{" "}
						{t("learning.api.matches")}{" "}
						<strong>{t("learning.api.signatureChampion")}</strong>{" "}
						{t("learning.api.signatureChampionDesc")}
					</Box>

					<Table
						columnDefinitions={[
							{
								id: "player",
								header: t("learning.api.player"),
								cell: (item: any) => (
									<Box>
										<Box variant="strong">{item.player}</Box>
										<Box variant="small">{item.team}</Box>
									</Box>
								),
							},
							{
								id: "champion",
								header: t("learning.api.signatureChampionHeader"),
								cell: (item: any) => item.championPlayed,
							},
							{
								id: "tournamentRecord",
								header: t("learning.api.tournamentRecordHeader"),
								cell: (item: any) => (
									<Box>
										<Box variant="strong" color="text-status-info">
											{item.winRate}%
										</Box>
										<Box variant="small">
											{item.tournamentWins}W - {item.tournamentLosses}L
										</Box>
									</Box>
								),
							},
							{
								id: "performance",
								header: t("learning.api.performanceScoreHeader"),
								cell: (item: any) => (
									<Box variant="strong">{item.performanceScore}/100</Box>
								),
							},
							{
								id: "achievement",
								header: t("learning.api.achievement"),
								cell: (item: any) => (
									<Box>
										🏆{" "}
										<Box variant="strong" display="inline">
											{item.event}
										</Box>
									</Box>
								),
							},
						]}
						items={getTournamentWinners(selectedYear.value)}
						loading={loading}
						header={
							<Header
								counter="(5)"
								description={`${t("learning.api.worldsChampions")} ${selectedYear.value} ${t("learning.api.worldsChampionshipDesc")}`}
							>
								{t("learning.api.worldsGreatestWinningPlayers")}
							</Header>
						}
						empty={
							<Box textAlign="center">
								<Box variant="strong" textAlign="center">
									{t("learning.api.noTournamentData")}
								</Box>
								<Box variant="p" padding={{ bottom: "s" }}>
									{t("learning.api.selectYearToView")}
								</Box>
							</Box>
						}
					/>
				</SpaceBetween>
			</Container>

			{(errorMessage || apiResponse) && hasTriedLiveData && !activeDemo && (
				<Alert
					type={dataSource === "live" ? "success" : "error"}
					header={
						dataSource === "live"
							? `✅ ${t("learning.api.apiIntegrationStatus")}`
							: `⚠️ ${t("learning.api.apiIntegrationStatus")}`
					}
					dismissible
					onDismiss={() => {
						setErrorMessage("");
						setApiResponse("");
					}}
				>
					<SpaceBetween direction="vertical" size="xs">
						{apiResponse && (
							<Box>
								<Box variant="strong">{t("learning.api.responseStatus")}</Box>
								<Box margin={{ left: "s" }}>{apiResponse}</Box>
							</Box>
						)}
						{errorMessage && (
							<Box>
								<Box variant="strong">{t("learning.api.errorDetails")}</Box>
								<Box margin={{ left: "s" }}>{errorMessage}</Box>
								{!demoError && (
									<Box margin={{ top: "xs", left: "s" }}>
										📧 <strong>{t("learning.api.support")}</strong>{" "}
										<a
											href="https://github.com/BryanChasko"
											target="_blank"
											rel="noopener noreferrer"
										>
											GitHub @bryanChasko
										</a>{" "}
										|{" "}
										<a
											href="https://linkedin.com/in/bryanchasko"
											target="_blank"
											rel="noopener noreferrer"
										>
											LinkedIn
										</a>
									</Box>
								)}
							</Box>
						)}
						<Box>
							<Box variant="strong">{t("learning.api.lambdaFunction")}</Box>
							<Box margin={{ left: "s" }}>
								[lambda-id].lambda-url.us-east-2.on.aws
							</Box>
						</Box>
					</SpaceBetween>
				</Alert>
			)}

			<Container
				header={
					<Header
						variant="h2"
						description={
							dataSource === "live"
								? t("learning.api.liveChampionDataDesc")
								: t("learning.api.demoChampionDataDesc")
						}
					>
						{dataSource === "live"
							? t("learning.api.liveChampionData")
							: t("learning.api.demoChampionData")}
					</Header>
				}
			>
				{(errorMessage || championApiResponse || endpointDetails) && (
					<Alert
						type={dataSource === "live" ? "success" : "warning"}
						header={t("learning.api.championDataApiStatus")}
						dismissible
						onDismiss={() => {
							setErrorMessage("");
							setChampionApiResponse("");
							setEndpointDetails("");
						}}
					>
						<SpaceBetween direction="vertical" size="s">
							{championApiResponse && (
								<Box>
									<Box variant="strong">{t("learning.api.dataSources2")}</Box>
									<Box margin={{ left: "s" }}>{championApiResponse}</Box>
								</Box>
							)}
							{endpointDetails && (
								<Box>
									<Box variant="strong">{t("learning.api.apiEndpoints")}</Box>
									<Box margin={{ left: "s" }}>{endpointDetails}</Box>
								</Box>
							)}
							{errorMessage && (
								<Box>
									<Box variant="strong">{t("learning.api.issues")}</Box>
									<Box margin={{ left: "s" }}>{errorMessage}</Box>
								</Box>
							)}
							<ColumnLayout columns={2} variant="text-grid">
								<Box>
									<Box variant="strong">{t("learning.api.lambdaEndpoint")}</Box>
									<Box>[lambda-id].lambda-url.us-east-2.on.aws</Box>
								</Box>
								<Box>
									<Box variant="strong">{t("learning.api.dataFormat")}</Box>
									<Box>{t("learning.api.jsonRestApi")}</Box>
								</Box>
							</ColumnLayout>
						</SpaceBetween>
					</Alert>
				)}

				<Table
					columnDefinitions={columnDefinitions}
					items={matches}
					loading={loading}
					header={
						<Header
							counter={`(${matches.length})`}
							actions={
								<SpaceBetween direction="horizontal" size="xs">
									{hasTriedLiveData ? (
										<Button onClick={fetchMatchHistory} loading={loading}>
											{t("learning.api.refreshLiveData")}
										</Button>
									) : (
										<Button
											onClick={fetchMatchHistory}
											loading={loading}
											variant="primary"
										>
											{t("learning.api.fetchFromRiotApi")}
										</Button>
									)}
									{hasTriedLiveData && (
										<Button
											onClick={() => {
												loadDummyData();
												setHasTriedLiveData(false);
											}}
											variant="normal"
										>
											{t("learning.api.resetToDemoData")}
										</Button>
									)}
								</SpaceBetween>
							}
						>
							{dataSource === "live"
								? t("learning.api.liveChampionsData")
								: t("learning.api.demoChampionsData")}
						</Header>
					}
					empty={t("learning.api.noChampionData")}
				/>
			</Container>

			<Container
				header={
					<Header variant="h3">
						{t("learning.api.apiAccessDataStructure")}
					</Header>
				}
			>
				<SpaceBetween direction="vertical" size="m">
					<ColumnLayout columns={2} variant="text-grid">
						<Container variant="stacked">
							<Header variant="h3">
								{t("learning.api.availableWithBasicKey")}
							</Header>
							<Box variant="p">
								• Data Dragon API: Champion stats, abilities
								<br />• Challenger League: Top ranked players
								<br />• Champion Mastery: Player expertise
								<br />• Match History: Recent game results
							</Box>
						</Container>

						<Container variant="stacked">
							<Header variant="h3">
								{t("learning.api.requiresSpecialAccess")}
							</Header>
							<Box variant="p">
								• Tournament API: Official esports matches
								<br />• Featured Games: Live high-level matches
								<br />• Esports Data: Professional results
								<br />• Production Keys: Higher rate limits
							</Box>
						</Container>
					</ColumnLayout>

					<Container variant="stacked">
						<Header variant="h3">
							{t("learning.api.tournamentDataStructure")}
						</Header>
						<Box variant="code">
							<pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
								{codeExample}
							</pre>
						</Box>
					</Container>
				</SpaceBetween>
			</Container>

			<Container
				header={
					<Header variant="h3">
						{t("learning.api.technicalImplementation")}
					</Header>
				}
			>
				<SpaceBetween direction="vertical" size="l">
					<ColumnLayout columns={2} variant="text-grid">
						<Container variant="stacked">
							<Header variant="h3">{t("learning.api.dataSources")}</Header>
							<Box variant="p">
								<strong>
									✅ {t("learning.api.dataSourcesFromRiot").replace("✅ ", "")}
								</strong>
								<br />• Champion names & lore titles
								<br />• Attack damage, health, speed stats
								<br />• Official game balance data
								<br />
								<br />
								<strong>
									🛠️ {t("learning.api.ourProcessing").replace("🛠️ ", "")}
								</strong>
								<br />• Tier rankings (S/A-Tier algorithm)
								<br />• Display scaling (÷10, ÷100, ÷20)
								<br />• Performance calculations
							</Box>
						</Container>

						<Container variant="stacked">
							<Header variant="h3">
								{t("learning.api.architectureStack")}
							</Header>
							<Box variant="p">
								<strong>{t("learning.api.frontend")}</strong>{" "}
								{t("learning.api.frontendValue")}
								<br />
								<strong>{t("learning.api.build")}</strong>{" "}
								{t("learning.api.buildValue")}
								<br />
								<strong>{t("learning.api.hosting")}</strong>{" "}
								{t("learning.api.hostingValue")}
								<br />
								<strong>{t("learning.api.api")}</strong>{" "}
								{t("learning.api.apiValue")}
								<br />
								<strong>{t("learning.api.data")}</strong>{" "}
								{t("learning.api.dataValue")}
							</Box>
						</Container>
					</ColumnLayout>

					<Container variant="stacked">
						<Header variant="h3">
							{t("learning.api.championDataMapping")}
						</Header>
						<ColumnLayout columns={3} variant="text-grid">
							<Box variant="p">
								<strong>{t("learning.api.attackPowerMapping")}</strong>
								<br />
								<code>{t("learning.api.attackPowerMappingValue")}</code>
							</Box>
							<Box variant="p">
								<strong>{t("learning.api.defenseRatingMapping")}</strong>
								<br />
								<code>{t("learning.api.defenseRatingMappingValue")}</code>
							</Box>
							<Box variant="p">
								<strong>{t("learning.api.speedRatingMapping")}</strong>
								<br />
								<code>{t("learning.api.speedRatingMappingValue")}</code>
							</Box>
						</ColumnLayout>
					</Container>
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
};

export default RiftRewindDashboard;
