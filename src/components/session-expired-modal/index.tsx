// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useEffect, useState } from "react";
import { useTranslation } from "../../hooks/useTranslation";

const SESSION_EXPIRED_EVENT = "cdn:session-expired";
const emitter = new EventTarget();

export function showSessionExpired(): void {
	emitter.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function SessionExpiredModal() {
	const { t } = useTranslation();
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const handler = () => setVisible(true);
		emitter.addEventListener(SESSION_EXPIRED_EVENT, handler);
		return () => emitter.removeEventListener(SESSION_EXPIRED_EVENT, handler);
	}, []);

	function handleLogin() {
		const returnTo = encodeURIComponent(window.location.href);
		window.location.assign(
			`https://auth.clouddelnorte.org/login/?returnTo=${returnTo}`,
		);
	}

	return (
		<Modal
			visible={visible}
			onDismiss={() => setVisible(false)}
			header={t("auth.sessionExpired.title")}
			footer={
				<Box float="right">
					<SpaceBetween direction="horizontal" size="xs">
						<Button variant="primary" onClick={handleLogin}>
							{t("auth.sessionExpired.loginButton")}
						</Button>
					</SpaceBetween>
				</Box>
			}
		>
			{t("auth.sessionExpired.body")}
		</Modal>
	);
}
