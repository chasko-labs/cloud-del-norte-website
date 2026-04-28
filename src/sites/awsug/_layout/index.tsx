// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import TopNavigation from "@cloudscape-design/components/top-navigation";
import type React from "react";
import { type AuthState, signOut } from "../_shared/auth";

interface AwsugLayoutProps {
	children: React.ReactNode;
	auth: AuthState;
}

export default function AwsugLayout({ children, auth }: AwsugLayoutProps) {
	return (
		<>
			<TopNavigation
				identity={{ href: "/index.html", title: "Cloud Del Norte — Members" }}
				utilities={[
					{ type: "button", text: "Meetings", href: "/meetings/index.html" },
					{ type: "button", text: "Admin", href: "/admin/index.html" },
					{
						type: "menu-dropdown",
						text: auth.email,
						items: [{ id: "signout", text: "Sign out" }],
						onItemClick: ({ detail }) => {
							if (detail.id === "signout") signOut();
						},
					},
				]}
			/>
			<div style={{ padding: "24px" }}>{children}</div>
		</>
	);
}
