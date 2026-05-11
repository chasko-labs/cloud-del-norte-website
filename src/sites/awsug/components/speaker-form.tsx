// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import type React from "react";
import { useState } from "react";

export function SpeakerForm() {
	const [name, setName] = useState("");
	const [topic, setTopic] = useState("");
	const [description, setDescription] = useState("");
	const [dates, setDates] = useState("");
	const [email, setEmail] = useState("");
	const [submitted, setSubmitted] = useState(false);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSubmitted(true);
	}

	if (submitted) {
		return (
			<Alert type="success">
				Thanks! We'll be in touch about your talk proposal.
			</Alert>
		);
	}

	return (
		<form onSubmit={handleSubmit} noValidate>
			<Form
				actions={
					<Button formAction="submit" variant="primary">
						Submit proposal
					</Button>
				}
			>
				<SpaceBetween size="m">
					<FormField label="Your name">
						<Input
							value={name}
							onChange={({ detail }) => setName(detail.value)}
							placeholder="First Last"
						/>
					</FormField>
					<FormField label="Talk title / topic">
						<Input
							value={topic}
							onChange={({ detail }) => setTopic(detail.value)}
							placeholder="e.g. Serverless at scale with Lambda"
						/>
					</FormField>
					<FormField label="Description">
						<Textarea
							value={description}
							onChange={({ detail }) => setDescription(detail.value)}
							rows={4}
							placeholder="Brief summary of your talk"
						/>
					</FormField>
					<FormField
						label="Preferred dates"
						description="Month(s) or specific dates that work for you"
					>
						<Input
							value={dates}
							onChange={({ detail }) => setDates(detail.value)}
							placeholder="e.g. June or July 2026"
						/>
					</FormField>
					<FormField label="Contact email">
						<Input
							type="email"
							value={email}
							onChange={({ detail }) => setEmail(detail.value)}
							placeholder="you@example.com"
						/>
					</FormField>
				</SpaceBetween>
			</Form>
		</form>
	);
}
