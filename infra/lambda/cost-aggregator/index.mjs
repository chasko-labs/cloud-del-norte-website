import {
	CostExplorerClient,
	GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

const SERVICE_MAP = {
	"Amazon Simple Storage Service": {
		name: "Storage",
		purpose: "Website files — HTML, images, documents",
	},
	"Amazon CloudFront": {
		name: "Fast delivery",
		purpose: "Serves the site from locations close to you",
	},
	"Amazon Route 53": {
		name: "Domain name",
		purpose: "Makes clouddelnorte.org point somewhere",
	},
	"AWS Certificate Manager": {
		name: "HTTPS locks",
		purpose: "The padlock in your browser",
	},
	"Amazon Cognito": {
		name: "Member accounts",
		purpose: "Handles login, signup, and keeping you signed in",
	},
	"Amazon API Gateway": {
		name: "Backend connections",
		purpose: "The bridge between the website and everything behind it",
	},
	"AWS Lambda": {
		name: "Background workers",
		purpose: "Small programs that run on demand",
	},
	"Amazon Simple Email Service": {
		name: "Email",
		purpose: "Sends account confirmations and password resets",
	},
	"Amazon Elastic Container Service": {
		name: "Video calls",
		purpose: "Runs live meetings — only charges when someone is on a call",
	},
	"Elastic Load Balancing": {
		name: "Video call routing",
		purpose: "Directs you to the right meeting server",
	},
	"AWS Key Management Service": {
		name: "Encryption",
		purpose: "Keeps member data locked down",
	},
	AmazonCloudWatch: {
		name: "Health checks",
		purpose: "Watches for problems before you notice",
	},
	"AWS CloudTrail": {
		name: "Security log",
		purpose: "Records who did what — our audit trail",
	},
	"AWS Systems Manager": {
		name: "Config store",
		purpose: "Securely stores settings and secrets",
	},
};

const ACCOUNTS = [
	{ id: "170473530355", name: "jitsi-video-hosting", role: null },
	{
		id: "211125425201",
		name: "aerospaceug-admin",
		role: "arn:aws:iam::211125425201:role/cost-reader-cross-account",
	},
	{
		id: "946179428633",
		name: "bryanchasko-kiro",
		role: "arn:aws:iam::946179428633:role/cost-reader-cross-account",
	},
];

const BUCKET = "awsaerospace.org";
const s3 = new S3Client({ region: "us-east-1" });
const sts = new STSClient({});

function dateFmt(d) {
	return d.toISOString().slice(0, 10);
}

function sanitize(str) {
	return str
		.replace(/\b\d{12}\b/g, "[REDACTED]")
		.replace(
			/arn:aws[a-zA-Z-]*:[a-zA-Z0-9-]+:[a-z0-9-]*:\d{12}:[^\s"',}]*/g,
			"[REDACTED_ARN]",
		)
		.replace(/\b[a-z]+-[a-f0-9]{8,17}\b/g, "[REDACTED_ID]")
		.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[REDACTED_IP]");
}

async function getCEClient(account) {
	if (!account.role) return new CostExplorerClient({});
	const { Credentials } = await sts.send(
		new AssumeRoleCommand({
			RoleArn: account.role,
			RoleSessionName: "cost-aggregator",
		}),
	);
	return new CostExplorerClient({
		credentials: {
			accessKeyId: Credentials.AccessKeyId,
			secretAccessKey: Credentials.SecretAccessKey,
			sessionToken: Credentials.SessionToken,
		},
	});
}

async function queryCosts(ce, start, end, filter) {
	const params = {
		TimePeriod: { Start: start, End: end },
		Granularity: "MONTHLY",
		Metrics: ["UnblendedCost"],
		GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
	};
	if (filter) params.Filter = filter;
	const resp = await ce.send(new GetCostAndUsageCommand(params));
	const costs = {};
	for (const group of resp.ResultsByTime.flatMap((r) => r.Groups)) {
		const svc = group.Keys[0];
		costs[svc] =
			(costs[svc] || 0) + parseFloat(group.Metrics.UnblendedCost.Amount);
	}
	return costs;
}

export async function handler() {
	const now = new Date();
	const end = dateFmt(now);
	const currentStart = dateFmt(new Date(now - 30 * 86400000));
	const prevStart = dateFmt(new Date(now - 60 * 86400000));

	// Aggregate current and previous period costs across all accounts
	const currentCosts = {};
	const prevCosts = {};

	for (const account of ACCOUNTS) {
		const ce = await getCEClient(account);
		const filter =
			account.id === "946179428633"
				? { Not: { Tags: { Key: "project", Values: ["bryanchasko-com"] } } }
				: undefined;

		const cur = await queryCosts(ce, currentStart, end, filter);
		const prev = await queryCosts(ce, prevStart, currentStart, filter);

		for (const [svc, amt] of Object.entries(cur)) {
			currentCosts[svc] = (currentCosts[svc] || 0) + amt;
		}
		for (const [svc, amt] of Object.entries(prev)) {
			prevCosts[svc] = (prevCosts[svc] || 0) + amt;
		}
	}

	// Build services array
	const services = [];
	let totalMonthlyCost = 0;

	for (const [svc, cost] of Object.entries(currentCosts)) {
		if (cost <= 0) continue;
		const mapped = SERVICE_MAP[svc] || {
			name: svc,
			purpose: "AWS infrastructure",
		};
		const prev = prevCosts[svc] || 0;
		let trend = "stable";
		if (prev > 0) {
			const change = (cost - prev) / prev;
			if (change > 0.1) trend = "up";
			else if (change < -0.1) trend = "down";
		} else if (cost > 0.01) {
			trend = "up";
		}
		totalMonthlyCost += cost;
		services.push({
			name: mapped.name,
			purpose: mapped.purpose,
			monthlyCost: Math.round(cost * 10000) / 10000,
			dailyAverage: Math.round((cost / 30) * 10000) / 10000,
			trend,
		});
	}

	services.sort((a, b) => b.monthlyCost - a.monthlyCost);

	const output = {
		meta: {
			lastUpdated: now.toISOString(),
			periodStart: currentStart,
			periodEnd: end,
			totalMonthlyCost: Math.round(totalMonthlyCost * 10000) / 10000,
			accounts: ACCOUNTS.length,
		},
		services,
	};

	const body = sanitize(JSON.stringify(output, null, 2));

	await Promise.all([
		s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: "data/costs/latest.json",
				Body: body,
				ContentType: "application/json",
			}),
		),
		s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: `data/costs/${end}.json`,
				Body: body,
				ContentType: "application/json",
			}),
		),
	]);

	return { statusCode: 200, body: `Wrote costs for ${end}` };
}
