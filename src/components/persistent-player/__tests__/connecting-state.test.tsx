// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { describe, expect, it } from "vitest";
import en from "../../../locales/en-US.json";

describe("connecting state copy and aria contract (wave 24b)", () => {
	it("en-US persistentPlayer.connecting key exists and reads 'connecting'", () => {
		expect(en.persistentPlayer?.connecting).toBe("connecting");
	});

	it("en-US persistentPlayer.retrying key exists and reads 'retrying'", () => {
		expect(en.persistentPlayer?.retrying).toBe("retrying");
	});

	it("en-US persistentPlayer.connectingAria key exists for screen readers", () => {
		expect(en.persistentPlayer?.connectingAria).toBe("connecting to stream");
	});
});
