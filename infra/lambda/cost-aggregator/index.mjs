import {
	CostExplorerClient,
	GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";

const SERVICE_MAP = {
	"Amazon Simple Storage Service": {
		name: "Storage",
		purpose: "Website files",
	},
	"Amazon CloudFront": {
		name: "Fast delivery",
		purpose: "Serves the site from locations close to you",
	},
	"Amazon Route 53": {
		name: "Domain DNS",
		purpose: "Makes clouddelnorte.org resolve",
	},
	"Amazon Registrar": {
		name: "Domain registration",
		purpose: "clouddelnorte.org annual renewal",
	},
	"Amazon Cognito": { name: "Member accounts", purpose: "Login, signup, MFA" },
	"Amazon API Gateway": {
		name: "Backend API",
		purpose: "Bridge between site and services",
	},
	"AWS Lambda": {
		name: "Background workers",
		purpose: "Small programs that run on demand",
	},
	"Amazon Simple Email Service": {
		name: "Email",
		purpose: "Account confirmations and resets",
	},
	"Amazon Elastic Container Service": {
		name: "Video calls",
		purpose: "Live meetings — charges only during calls",
	},
	"Elastic Load Balancing": {
		name: "Video call routing",
		purpose: "Directs you to the right meeting server",
	},
	"AWS Key Management Service": {
		name: "Encryption",
		purpose: "Keeps member data locked",
	},
	AmazonCloudWatch: { name: "Health checks", purpose: "Watches for problems" },
	"AWS Secrets Manager": {
		name: "Secrets",
		purpose: "Stores API keys and passwords securely",
	},
	"Amazon Q": {
		name: "Amazon Q",
		purpose: "AI developer assistant (discontinued)",
	},
	Tax: { name: "Tax", purpose: "Sales tax" },
	"Amazon Bedrock AgentCore": {
		name: "Bedrock AgentCore",
		purpose: "AI agent infrastructure",
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

const BUCKET = "clouddelnorte.org";
const s3 = new S3Client({ region: "us-east-1" });
const sts = new STSClient({});

function dateFmt(d) {
	return d.toISOString().slice(0, 10);
}
function monthStart(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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
	const res = await ce.send(new GetCostAndUsageCommand(params));
	return res.ResultsByTime || [];
}

export async function handler() {
	const now = new Date();
	const end = dateFmt(now);
	const sixMonthsAgo = new Date(now);
	sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
	const start = monthStart(sixMonthsAgo);

	// Aggregate across all accounts
	const monthlyTotals = {};
	const serviceTotals = {};

	for (const account of ACCOUNTS) {
		const ce = await getCEClient(account);
		const filter =
			account.id === "946179428633"
				? { Not: { Tags: { Key: "project", Values: ["bryanchasko-com"] } } }
				: undefined;
		const results = await queryCosts(ce, start, end, filter);
		for (const period of results) {
			const month = period.TimePeriod.Start;
			if (!monthlyTotals[month]) monthlyTotals[month] = 0;
			for (const group of period.Groups || []) {
				const svc = group.Keys[0];
				const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
				if (cost <= 0) continue;
				monthlyTotals[month] += cost;
				if (!serviceTotals[svc]) serviceTotals[svc] = 0;
				serviceTotals[svc] += cost;
			}
		}
	}

	// Build services array (6-month totals)
	const services = [];
	let grandTotal = 0;
	for (const [svc, cost] of Object.entries(serviceTotals)) {
		if (cost <= 0) continue;
		const mapped = SERVICE_MAP[svc] || {
			name: svc,
			purpose: "AWS infrastructure",
		};
		grandTotal += cost;
		services.push({
			name: mapped.name,
			purpose: mapped.purpose,
			totalCost: Math.round(cost * 100) / 100,
		});
	}
	services.sort((a, b) => b.totalCost - a.totalCost);

	// Monthly breakdown
	const months = Object.entries(monthlyTotals)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));

	const output = {
		meta: {
			lastUpdated: now.toISOString(),
			periodStart: start,
			periodEnd: end,
			grandTotal: Math.round(grandTotal * 100) / 100,
			accounts: ACCOUNTS.length,
		},
		months,
		services,
	};

	const body = JSON.stringify(output, null, 2);
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
				Key: `data/costs/${dateFmt(now)}.json`,
				Body: body,
				ContentType: "application/json",
			}),
		),
	]);
	return { statusCode: 200, body: `Wrote costs for ${dateFmt(now)}` };
}
