import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useEffect, useState } from "react";
import {
	AuthError,
	base64urlToBuffer,
	completeWebAuthnRegistration,
	deleteWebAuthnCredential,
	getAccessToken,
	listWebAuthnCredentials,
	startWebAuthnRegistration,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";

function PasskeyManager() {
	const [credentials, setCredentials] = useState<
		Array<Record<string, unknown>>
	>([]);
	const [loading, setLoading] = useState(true);
	const [registering, setRegistering] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	async function loadCredentials() {
		try {
			const creds = await listWebAuthnCredentials();
			setCredentials(creds);
		} catch (err) {
			setError(
				err instanceof AuthError ? err.message : "failed to load passkeys",
			);
		} finally {
			setLoading(false);
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: loadCredentials only uses stable setters
	useEffect(() => {
		void loadCredentials();
	}, []);

	async function handleRegister() {
		setRegistering(true);
		setError("");
		setSuccess("");
		try {
			const options = await startWebAuthnRegistration();
			let creationOptions = (options.CredentialCreationOptions ??
				(options as any).credentialCreationOptions) as any;
			if (!creationOptions)
				throw new AuthError(
					"WebAuthn registration not available — check pool configuration",
				);
			if (typeof creationOptions === "string")
				creationOptions = JSON.parse(creationOptions);
			// Cognito returns the publicKey options directly (no .publicKey wrapper)
			const publicKey = creationOptions.publicKey ?? creationOptions;
			publicKey.challenge = base64urlToBuffer(publicKey.challenge);
			publicKey.user.id = base64urlToBuffer(publicKey.user.id);
			if (publicKey.excludeCredentials) {
				publicKey.excludeCredentials = publicKey.excludeCredentials.map(
					(c: any) => ({
						...c,
						id: base64urlToBuffer(c.id),
					}),
				);
			}
			const credential = (await navigator.credentials.create({
				publicKey,
			})) as PublicKeyCredential;
			if (!credential) throw new AuthError("registration cancelled");
			const attestation =
				credential.response as AuthenticatorAttestationResponse;

			// Use toJSON() if available (WebAuthn L3) — Cognito expects this format
			const credentialData =
				typeof (credential as any).toJSON === "function"
					? (credential as any).toJSON()
					: {
							id: credential.id,
							rawId: bufferToBase64url(credential.rawId),
							type: credential.type,
							response: {
								clientDataJSON: bufferToBase64url(attestation.clientDataJSON),
								attestationObject: bufferToBase64url(
									attestation.attestationObject,
								),
								transports:
									typeof attestation.getTransports === "function"
										? attestation.getTransports()
										: [],
							},
							authenticatorAttachment:
								credential.authenticatorAttachment ?? "platform",
							clientExtensionResults: credential.getClientExtensionResults(),
						};
			await completeWebAuthnRegistration(credentialData);
			setSuccess("passkey registered");
			void loadCredentials();
		} catch (err) {
			const msg = err instanceof Error ? err.message : "registration failed";
			setError(msg);
			console.error("passkey registration error:", err);
		} finally {
			setRegistering(false);
		}
	}

	async function handleAddDevice() {
		setRegistering(true);
		setError("");
		setSuccess("");
		try {
			const options = await startWebAuthnRegistration();
			let creationOptions = (options.CredentialCreationOptions ??
				(options as any).credentialCreationOptions) as any;
			if (!creationOptions) throw new AuthError("WebAuthn not available");
			if (typeof creationOptions === "string")
				creationOptions = JSON.parse(creationOptions);
			const publicKey = creationOptions.publicKey ?? creationOptions;
			publicKey.challenge = base64urlToBuffer(publicKey.challenge);
			publicKey.user.id = base64urlToBuffer(publicKey.user.id);
			if (publicKey.excludeCredentials) {
				publicKey.excludeCredentials = publicKey.excludeCredentials.map(
					(c: any) => ({ ...c, id: base64urlToBuffer(c.id) }),
				);
			}
			// Force cross-platform — triggers QR code for phone/tablet
			publicKey.authenticatorSelection = {
				...publicKey.authenticatorSelection,
				authenticatorAttachment: "cross-platform",
			};
			const credential = (await navigator.credentials.create({
				publicKey,
			})) as PublicKeyCredential;
			if (!credential) throw new AuthError("registration cancelled");
			const attestation =
				credential.response as AuthenticatorAttestationResponse;
			const credentialData =
				typeof (credential as any).toJSON === "function"
					? (credential as any).toJSON()
					: {
							id: credential.id,
							rawId: bufferToBase64url(credential.rawId),
							type: credential.type,
							response: {
								clientDataJSON: bufferToBase64url(attestation.clientDataJSON),
								attestationObject: bufferToBase64url(
									attestation.attestationObject,
								),
								transports:
									typeof attestation.getTransports === "function"
										? attestation.getTransports()
										: [],
							},
							authenticatorAttachment:
								credential.authenticatorAttachment ?? "cross-platform",
							clientExtensionResults: credential.getClientExtensionResults(),
						};
			await completeWebAuthnRegistration(credentialData);
			setSuccess("device added");
			void loadCredentials();
		} catch (err) {
			const msg = err instanceof Error ? err.message : "failed to add device";
			setError(msg);
		} finally {
			setRegistering(false);
		}
	}

	async function handleDelete(credentialId: string) {
		try {
			await deleteWebAuthnCredential(credentialId);
			void loadCredentials();
		} catch (err) {
			setError(err instanceof AuthError ? err.message : "delete failed");
		}
	}

	if (!getAccessToken()) {
		window.location.assign(
			"/login/index.html?return_to=%2Fpasskeys%2Findex.html",
		);
		return null;
	}

	if (loading)
		return (
			<Box padding="xxl" textAlign="center">
				<Spinner size="large" />
			</Box>
		);

	return (
		<SpaceBetween size="l">
			<Container
				header={
					<Header
						variant="h1"
						actions={
							<SpaceBetween direction="horizontal" size="xs">
								<Button
									onClick={() => {
										void handleRegister();
									}}
									loading={registering}
									iconName="add-plus"
								>
									add passkey
								</Button>
								<Button
									onClick={() => {
										void handleAddDevice();
									}}
									loading={registering}
									variant="normal"
									iconName="status-positive"
								>
									add device
								</Button>
							</SpaceBetween>
						}
					>
						passwordless sign in
					</Header>
				}
			>
				<SpaceBetween size="m">
					{error && <Alert type="error">{error}</Alert>}
					{success && <Alert type="success">{success}</Alert>}
					<Box>
						sign in with biometrics (face id, fingerprint, windows hello) or add
						another device.
					</Box>
					{credentials.length === 0 ? (
						<Box color="text-status-inactive">
							no passkeys registered. add one to enable biometric sign-in.
						</Box>
					) : (
						credentials.map((cred) => (
							<Box key={cred.CredentialId as string} padding="s" variant="div">
								<SpaceBetween
									direction="horizontal"
									size="s"
									alignItems="center"
								>
									<Box variant="code">
										{(cred.FriendlyCredentialName as string) ||
											(cred.CredentialId as string).slice(0, 12)}
									</Box>
									<Box color="text-status-inactive" fontSize="body-s">
										created{" "}
										{new Date(cred.CreatedAt as string).toLocaleDateString()}
									</Box>
									<Button
										variant="icon"
										iconName="remove"
										onClick={() => {
											void handleDelete(cred.CredentialId as string);
										}}
									/>
								</SpaceBetween>
							</Box>
						))
					)}
				</SpaceBetween>
			</Container>
		</SpaceBetween>
	);
}

function bufferToBase64url(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

export default function App() {
	return (
		<AuthLayout pageContext="passkeys">
			<PasskeyManager />
		</AuthLayout>
	);
}
