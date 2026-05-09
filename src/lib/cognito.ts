// Direct Cognito API calls for custom auth forms.
// No AWS SDK — raw fetch against the regional endpoint.
// Tokens stored in sessionStorage (tab-scoped, same policy as auth.ts).

const REGION = "us-west-2";
const CLIENT_ID = "57eikmt418ea6vti2f6h0pl74r";
const ENDPOINT = `https://cognito-idp.${REGION}.amazonaws.com/`;

const KEY_ID_TOKEN = "cdn.idToken";
const KEY_ACCESS_TOKEN = "cdn.accessToken";
const KEY_REFRESH_TOKEN = "cdn.refreshToken";
const KEY_EXPIRES_AT = "cdn.expiresAt";

// ---- Input sanitization ----

export const FIELD_LIMITS: Record<string, number> = {
	email: 254,
	password: 256,
	display_name: 100,
	member_type: 200,
	location: 100,
	topics: 500,
	background: 1000,
	code: 10,
};

export function sanitize(
	value: string,
	field: keyof typeof FIELD_LIMITS,
): string {
	const trimmed = value.trim();
	const limit = FIELD_LIMITS[field] ?? 256;
	return trimmed.slice(0, limit);
}

export function assertNonEmpty(value: string, label: string): void {
	if (value.trim().length === 0) throw new AuthError(`${label} is required`);
}

// ---- Error type ----

export class AuthError extends Error {
	constructor(
		message: string,
		public readonly code?: string,
	) {
		super(message);
		this.name = "AuthError";
	}
}

// ---- Cognito fetch helper ----

async function cognitoPost(
	target: string,
	body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-amz-json-1.1",
			"X-Amz-Target": `AWSCognitoIdentityProviderService.${target}`,
		},
		body: JSON.stringify(body),
	});
	const json = (await res.json()) as Record<string, unknown>;
	if (!res.ok) {
		const code = (json.__type as string | undefined) ?? "UnknownError";
		const msg = (json.message as string | undefined) ?? "An error occurred";
		throw new AuthError(msg, code);
	}
	return json;
}

// ---- Token storage ----

function storeTokens(result: Record<string, unknown>): void {
	const auth = result.AuthenticationResult as Record<string, unknown>;
	sessionStorage.setItem(KEY_ID_TOKEN, auth.IdToken as string);
	sessionStorage.setItem(KEY_ACCESS_TOKEN, auth.AccessToken as string);
	if (auth.RefreshToken)
		sessionStorage.setItem(KEY_REFRESH_TOKEN, auth.RefreshToken as string);
	sessionStorage.setItem(
		KEY_EXPIRES_AT,
		String(Date.now() + (auth.ExpiresIn as number) * 1000),
	);
}

function isExpired(): boolean {
	const raw = sessionStorage.getItem(KEY_EXPIRES_AT);
	if (!raw) return true;
	return Date.now() >= Number(raw);
}

export function getIdToken(): string | null {
	if (isExpired()) return null;
	return sessionStorage.getItem(KEY_ID_TOKEN);
}

export function getAccessToken(): string | null {
	if (isExpired()) return null;
	return sessionStorage.getItem(KEY_ACCESS_TOKEN);
}

export function getRefreshToken(): string | null {
	return sessionStorage.getItem(KEY_REFRESH_TOKEN);
}

export function clearTokens(): void {
	[KEY_ID_TOKEN, KEY_ACCESS_TOKEN, KEY_REFRESH_TOKEN, KEY_EXPIRES_AT].forEach(
		(k) => sessionStorage.removeItem(k),
	);
}

export function decodeToken(jwt: string): Record<string, unknown> {
	const parts = jwt.split(".");
	if (parts.length < 2) throw new AuthError("malformed jwt");
	let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
	const pad = payload.length % 4;
	if (pad) payload += "=".repeat(4 - pad);
	return JSON.parse(atob(payload)) as Record<string, unknown>;
}

// ---- Auth actions ----

export interface AuthChallenge {
	challengeName: string;
	session: string;
}

export type SignInResult =
	| { type: "success" }
	| { type: "challenge"; challenge: AuthChallenge };

export async function signInWithPassword(
	email: string,
	password: string,
): Promise<SignInResult> {
	const result = await cognitoPost("InitiateAuth", {
		AuthFlow: "USER_PASSWORD_AUTH",
		ClientId: CLIENT_ID,
		AuthParameters: {
			USERNAME: sanitize(email, "email"),
			PASSWORD: password,
		},
	});
	if (result.ChallengeName) {
		return {
			type: "challenge",
			challenge: {
				challengeName: result.ChallengeName as string,
				session: result.Session as string,
			},
		};
	}
	storeTokens(result);
	return { type: "success" };
}

export async function associateSoftwareToken(
	session: string,
): Promise<{ secretCode: string; session: string }> {
	const result = await cognitoPost("AssociateSoftwareToken", {
		Session: session,
	});
	return {
		secretCode: result.SecretCode as string,
		session: result.Session as string,
	};
}

export async function verifySoftwareToken(
	session: string,
	code: string,
): Promise<string> {
	const result = await cognitoPost("VerifySoftwareToken", {
		Session: session,
		UserCode: sanitize(code, "code"),
		FriendlyDeviceName: "authenticator",
	});
	return (result.Session as string) ?? session;
}

export async function respondToMfaChallenge(
	session: string,
	code: string,
	challengeName: string,
): Promise<void> {
	const result = await cognitoPost("RespondToAuthChallenge", {
		ClientId: CLIENT_ID,
		ChallengeName: challengeName,
		Session: session,
		ChallengeResponses: {
			SOFTWARE_TOKEN_MFA_CODE: sanitize(code, "code"),
			USERNAME: sessionStorage.getItem("cdn.mfaUsername") ?? "",
		},
	});
	if (result.ChallengeName) {
		throw new AuthError(
			"Additional challenge required",
			result.ChallengeName as string,
		);
	}
	storeTokens(result);
}

export interface SignUpFields {
	email: string;
	password: string;
	displayName: string;
	memberType?: string;
	location?: string;
	topics?: string;
	background?: string;
}

export async function signUp(fields: SignUpFields): Promise<void> {
	const attrs: Array<{ Name: string; Value: string }> = [
		{ Name: "email", Value: sanitize(fields.email, "email") },
		{ Name: "name", Value: sanitize(fields.displayName, "display_name") },
	];
	if (fields.memberType?.trim()) {
		attrs.push({
			Name: "custom:member_type",
			Value: sanitize(fields.memberType, "member_type"),
		});
	}
	if (fields.location?.trim()) {
		attrs.push({
			Name: "custom:location",
			Value: sanitize(fields.location, "location"),
		});
	}
	if (fields.topics?.trim()) {
		attrs.push({
			Name: "custom:topics",
			Value: sanitize(fields.topics, "topics"),
		});
	}
	if (fields.background?.trim()) {
		attrs.push({
			Name: "custom:background",
			Value: sanitize(fields.background, "background"),
		});
	}
	await cognitoPost("SignUp", {
		ClientId: CLIENT_ID,
		Username: sanitize(fields.email, "email"),
		Password: fields.password,
		UserAttributes: attrs,
	});
}

export async function confirmSignUp(
	email: string,
	code: string,
): Promise<void> {
	await cognitoPost("ConfirmSignUp", {
		ClientId: CLIENT_ID,
		Username: sanitize(email, "email"),
		ConfirmationCode: sanitize(code, "code"),
	});
}

export async function resendConfirmationCode(email: string): Promise<void> {
	await cognitoPost("ResendConfirmationCode", {
		ClientId: CLIENT_ID,
		Username: sanitize(email, "email"),
	});
}

export async function forgotPassword(email: string): Promise<void> {
	await cognitoPost("ForgotPassword", {
		ClientId: CLIENT_ID,
		Username: sanitize(email, "email"),
	});
}

export async function confirmForgotPassword(
	email: string,
	code: string,
	newPassword: string,
): Promise<void> {
	await cognitoPost("ConfirmForgotPassword", {
		ClientId: CLIENT_ID,
		Username: sanitize(email, "email"),
		ConfirmationCode: sanitize(code, "code"),
		Password: newPassword,
	});
}

export async function refreshTokens(): Promise<void> {
	const refresh = getRefreshToken();
	if (!refresh) throw new AuthError("no refresh token");
	const result = await cognitoPost("InitiateAuth", {
		AuthFlow: "REFRESH_TOKEN_AUTH",
		ClientId: CLIENT_ID,
		AuthParameters: { REFRESH_TOKEN: refresh },
	});
	const auth = result.AuthenticationResult as Record<string, unknown>;
	if (!auth.RefreshToken) auth.RefreshToken = refresh;
	storeTokens(result);
}
// ---- Passkey / WebAuthn ----

export async function startWebAuthnRegistration(): Promise<
	Record<string, unknown>
> {
	const accessToken = getAccessToken();
	if (!accessToken) throw new AuthError("not authenticated");
	return cognitoPost("StartWebAuthnRegistration", { AccessToken: accessToken });
}

export async function completeWebAuthnRegistration(
	credential: Record<string, unknown>,
): Promise<void> {
	const accessToken = getAccessToken();
	if (!accessToken) throw new AuthError("not authenticated");
	await cognitoPost("CompleteWebAuthnRegistration", {
		AccessToken: accessToken,
		Credential: credential,
	});
}

export async function listWebAuthnCredentials(): Promise<
	Array<Record<string, unknown>>
> {
	const accessToken = getAccessToken();
	if (!accessToken) throw new AuthError("not authenticated");
	const result = await cognitoPost("ListWebAuthnCredentials", {
		AccessToken: accessToken,
	});
	return (result.Credentials as Array<Record<string, unknown>>) ?? [];
}

export async function deleteWebAuthnCredential(
	credentialId: string,
): Promise<void> {
	const accessToken = getAccessToken();
	if (!accessToken) throw new AuthError("not authenticated");
	await cognitoPost("DeleteWebAuthnCredential", {
		AccessToken: accessToken,
		CredentialId: credentialId,
	});
}

export async function initiatePasskeyAuth(email: string): Promise<{
	challengeName: string;
	session: string;
	credentials: Record<string, unknown>;
}> {
	const result = await cognitoPost("InitiateAuth", {
		AuthFlow: "USER_AUTH",
		ClientId: CLIENT_ID,
		AuthParameters: {
			USERNAME: sanitize(email, "email"),
			PREFERRED_CHALLENGE: "WEB_AUTHN",
		},
	});
	return {
		challengeName: result.ChallengeName as string,
		session: result.Session as string,
		credentials: JSON.parse(
			(result.ChallengeParameters as Record<string, string> | undefined)
				?.CredentialRequestOptions ?? "{}",
		),
	};
}

export async function completePasskeyAuth(
	session: string,
	credential: PublicKeyCredential,
): Promise<void> {
	const response = credential.response as AuthenticatorAssertionResponse;
	const result = await cognitoPost("RespondToAuthChallenge", {
		ClientId: CLIENT_ID,
		ChallengeName: "WEB_AUTHN",
		Session: session,
		ChallengeResponses: {
			CREDENTIAL: JSON.stringify({
				id: credential.id,
				rawId: bufferToBase64url(credential.rawId),
				type: credential.type,
				response: {
					clientDataJSON: bufferToBase64url(response.clientDataJSON),
					authenticatorData: bufferToBase64url(response.authenticatorData),
					signature: bufferToBase64url(response.signature),
					userHandle: response.userHandle
						? bufferToBase64url(response.userHandle)
						: null,
				},
				authenticatorAttachment: credential.authenticatorAttachment,
			}),
		},
	});
	if (result.AuthenticationResult) {
		storeTokens(result);
	}
}

// ---- Base64url helpers for WebAuthn ----

function bufferToBase64url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
	const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	const pad = base64.length % 4;
	const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes.buffer;
}

export { base64urlToBuffer };
