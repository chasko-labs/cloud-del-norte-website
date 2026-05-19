// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from "react";
import ReactDOM from "react-dom/client";

import "@cloudscape-design/global-styles/index.css";
import "../../styles/tokens.css";
import "../../styles/cdn-skeleton.css";

import App from "./app";
import { initScrollJankMitigation } from "./scroll-jank-mitigation";

const root = ReactDOM.createRoot(document.getElementById("root")!);

root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

// wave 30a — pause the wave 27a v2 featured-event animations during fast
// scroll so the compositor can focus on the scroll itself. Animations
// resume 250ms after scroll settles. Self-skips under prefers-reduced-motion.
initScrollJankMitigation();
