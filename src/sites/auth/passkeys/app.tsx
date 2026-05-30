import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import {
	AuthError,
	base64urlToBuffer,
	completeWebAuthnRegistration,
	decodeToken,
	deleteWebAuthnCredential,
	getAccessToken,
	listWebAuthnCredentials,
	type RegistrationResponseJSON,
	startWebAuthnRegistration,
} from "../../../lib/cognito";
import AuthLayout from "../_layout";
import "./styles.css";

/** Cognito creation options shape — may arrive as string or nested object. */
interface CreationOptionsPayload {
	publicKey?: Record<string, unknown>;
	challenge?: string;
	user?: { id: string };
	excludeCredentials?: Array<{ id: string; type: string }>;
	authenticatorSelection?: Record<string, unknown>;
	[key: string]: unknown;
}

function PasskeyManager() {
	const [credentials, setCredentials] = useState<
		Array<Record<string, unknown>>
	>([]);
	const [loading, setLoading] = useState(true);
	const [registering, setRegistering] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [step, setStep] = useState<1 | 2>(1);

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
			let creationOptions: CreationOptionsPayload | string | undefined =
				(options.CredentialCreationOptions ??
					(options as Record<string, unknown>).credentialCreationOptions) as
					| CreationOptionsPayload
					| string
					| undefined;
			if (!creationOptions)
				throw new AuthError(
					"WebAuthn registration not available — check pool configuration",
				);
			if (typeof creationOptions === "string")
				creationOptions = JSON.parse(creationOptions) as CreationOptionsPayload;
			// Cognito returns the publicKey options directly (no .publicKey wrapper)
			const publicKey =
				(creationOptions as CreationOptionsPayload).publicKey ??
				(creationOptions as Record<string, unknown>);
			(publicKey as Record<string, unknown>).challenge = base64urlToBuffer(
				(publicKey as Record<string, unknown>).challenge as string,
			);
			(
				publicKey as Record<string, unknown> & { user: { id: string } }
			).user.id = base64urlToBuffer(
				(publicKey as Record<string, unknown> & { user: { id: string } }).user
					.id,
			) as unknown as string;
			if ((publicKey as Record<string, unknown>).excludeCredentials) {
				(publicKey as Record<string, unknown>).excludeCredentials = (
					(publicKey as Record<string, unknown>).excludeCredentials as Array<
						Record<string, unknown>
					>
				).map((c) => ({
					...c,
					id: base64urlToBuffer(c.id as string),
				}));
			}
			const credential = (await navigator.credentials.create({
				publicKey: publicKey as unknown as PublicKeyCredentialCreationOptions,
			})) as PublicKeyCredential | null;
			if (!credential) throw new AuthError("registration cancelled");
			const attestation =
				credential.response as AuthenticatorAttestationResponse;

			// Use toJSON() if available (WebAuthn L3) — Cognito expects this format
			const credentialData: RegistrationResponseJSON =
				"toJSON" in credential && typeof credential.toJSON === "function"
					? (credential.toJSON() as unknown as RegistrationResponseJSON)
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
			try {
				const idToken = sessionStorage.getItem("cdn.idToken");
				if (idToken) {
					const payload = decodeToken(idToken);
					const email =
						typeof payload.email === "string" ? payload.email : null;
					if (email) localStorage.setItem("cdn.passkey_email", email);
				}
			} catch {
				/* non-fatal */
			}
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
			let creationOptions: CreationOptionsPayload | string | undefined =
				(options.CredentialCreationOptions ??
					(options as Record<string, unknown>).credentialCreationOptions) as
					| CreationOptionsPayload
					| string
					| undefined;
			if (!creationOptions) throw new AuthError("WebAuthn not available");
			if (typeof creationOptions === "string")
				creationOptions = JSON.parse(creationOptions) as CreationOptionsPayload;
			const publicKey =
				(creationOptions as CreationOptionsPayload).publicKey ??
				(creationOptions as Record<string, unknown>);
			(publicKey as Record<string, unknown>).challenge = base64urlToBuffer(
				(publicKey as Record<string, unknown>).challenge as string,
			);
			(
				publicKey as Record<string, unknown> & { user: { id: string } }
			).user.id = base64urlToBuffer(
				(publicKey as Record<string, unknown> & { user: { id: string } }).user
					.id,
			) as unknown as string;
			if ((publicKey as Record<string, unknown>).excludeCredentials) {
				(publicKey as Record<string, unknown>).excludeCredentials = (
					(publicKey as Record<string, unknown>).excludeCredentials as Array<
						Record<string, unknown>
					>
				).map((c) => ({ ...c, id: base64urlToBuffer(c.id as string) }));
			}
			// Force cross-platform — triggers QR code for phone/tablet
			publicKey.authenticatorSelection = {
				...((publicKey.authenticatorSelection as Record<string, unknown>) ??
					{}),
				authenticatorAttachment: "cross-platform",
			};
			const credential = (await navigator.credentials.create({
				publicKey: publicKey as unknown as PublicKeyCredentialCreationOptions,
			})) as PublicKeyCredential | null;
			if (!credential) throw new AuthError("registration cancelled");
			const attestation =
				credential.response as AuthenticatorAttestationResponse;
			const credentialData: RegistrationResponseJSON =
				"toJSON" in credential && typeof credential.toJSON === "function"
					? (credential.toJSON() as unknown as RegistrationResponseJSON)
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
			setStep(2);
			try {
				const idToken = sessionStorage.getItem("cdn.idToken");
				if (idToken) {
					const payload = decodeToken(idToken);
					const email =
						typeof payload.email === "string" ? payload.email : null;
					if (email) localStorage.setItem("cdn.passkey_email", email);
				}
			} catch {
				/* non-fatal */
			}
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
		window.location.assign(`/login/index.html${window.location.search}`);
		return null;
	}

	if (loading)
		return (
			<Box padding="xxl" textAlign="center">
				<Spinner size="large" />
			</Box>
		);

	return (
		<div className="cdn-passkeys-wrap">
			<SpaceBetween size="l">
				{step === 2 && (
					<Container
						header={
							<Header variant="h1">step 2: sign in on your device</Header>
						}
					>
						<SpaceBetween size="l" alignItems="center">
							<Alert type="success">device added successfully</Alert>
							<Box textAlign="center">
								<QRCodeSVG
									value="https://auth.clouddelnorte.org/login/index.html"
									size={200}
									style={{
										borderRadius: "12px",
										border: "3px solid var(--cdn-violet, #9060f0)",
									}}
								/>
							</Box>
							<Box
								textAlign="center"
								color="text-status-inactive"
								fontSize="body-s"
							>
								scan with your phone — your passkey will be offered
								automatically
							</Box>
							<Button variant="link" onClick={() => setStep(1)}>
								← back to devices
							</Button>
						</SpaceBetween>
					</Container>
				)}
				{step === 1 && (
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
								sign in with biometrics (face id, fingerprint, windows hello) or
								add another device.
							</Box>
							{credentials.length === 0 ? (
								<Box color="text-status-inactive">
									no passkeys registered. add one to enable biometric sign-in.
								</Box>
							) : (
								credentials.map((cred) => {
									const created = cred.CreatedAt;
									const date =
										typeof created === "number"
											? new Date(created * 1000)
											: new Date(created as string);
									return (
										<Box
											key={cred.CredentialId as string}
											padding="s"
											variant="div"
										>
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
													created {date.toLocaleDateString()}
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
									);
								})
							)}
						</SpaceBetween>
					</Container>
				)}
				<Box textAlign="center" padding="l">
					<SpaceBetween direction="horizontal" size="m" alignItems="center">
						<Button variant="link" href="https://awsug.clouddelnorte.org/">
							← back to members area
						</Button>
						<Button
							variant="link"
							onClick={() => {
								sessionStorage.clear();
								localStorage.removeItem("cdn.passkey_email");
								window.location.assign("/login/index.html");
							}}
						>
							sign out
						</Button>
					</SpaceBetween>
				</Box>
			</SpaceBetween>
		</div>
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
