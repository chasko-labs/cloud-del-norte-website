import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * wave 33d — light mode tone-down regression guard.
 *
 * Bryan: "light mode looks particularly hard on the eyes right now".
 * The accumulated waves produced too many high-saturation warm/violet/amber
 * accents + high-alpha shadows + near-pure-white control surfaces in light
 * mode. Wave 33d softened a focused set of light-mode tokens.
 *
 * This test pins the post-wave-33d values so a future contributor can't drift
 * back toward the brighter pre-wave-33d state without intentionally updating
 * this fixture. We assert raw substring presence in the CSS source rather
 * than getComputedStyle() because:
 *   - the tokens.css block we care about is light-mode only, but the test
 *     env (jsdom) doesn't paint, so getComputedStyle on :root would return
 *     whichever side wins via cascade — not a stable signal.
 *   - the values we're regressing on are inline literals inside :root + body
 *     blocks, so a textual pin is exactly the right granularity.
 *
 * If wave-NN changes one of these intentionally, update the fixture in the
 * same PR with a comment explaining why the new value is tone-appropriate.
 */

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

describe("wave 33d — light mode tone-down tokens", () => {
	const tokensCss = readFileSync(
		resolve(REPO_ROOT, "src/styles/tokens.css"),
		"utf-8",
	);
	const feedCss = readFileSync(
		resolve(REPO_ROOT, "src/pages/feed/styles.css"),
		"utf-8",
	);

	it("--cdn-card-rim-light light-mode inset highlight is softened to 0.6", () => {
		// rim-light :root block — first inset 0 1px 0 rgba(255, 250, 235, X)
		// pin: was 0.85, now 0.6 (~30% softer).
		expect(tokensCss).toContain(
			"inset 0 1px 0 rgba(255, 250, 235, 0.6),\n\t\tinset 0 -1px 0 rgba(139, 90, 43, 0.06)",
		);
		// regression: the prior 0.85 value should not be present in the
		// :root rim-light block. We allow it elsewhere (the replacement
		// inline rule in feed/styles.css is now 0.55, also softer).
		expect(tokensCss).not.toContain("inset 0 1px 0 rgba(255, 250, 235, 0.85)");
	});

	it("--cdn-shadow-card-light is reduced to ~70% of pre-33d alphas", () => {
		// pin the new value: 0.07 / 0.08 / 0.05 (was 0.10 / 0.12 / 0.08)
		expect(tokensCss).toContain(
			"--cdn-shadow-card-light:\n\t\t0 1px 3px rgba(139, 90, 43, 0.07), 0 4px 10px -2px rgba(139, 90, 43, 0.08),\n\t\t0 8px 20px -4px rgba(139, 90, 43, 0.05);",
		);
	});

	it("Cloudscape light-mode control surfaces unify on the warm cream #faf7f0 (no near-pure-white #fdfcf8 / #fefcf8)", () => {
		// the body override block should no longer contain the old
		// near-pure-white values — they were causing accumulated bright
		// surfaces against the warm-cream container backgrounds.
		const bodyBlockMatch = tokensCss.match(
			/html:not\(\.awsui-dark-mode\) body \{[^}]+\}/,
		);
		expect(bodyBlockMatch).not.toBeNull();
		const bodyBlock = bodyBlockMatch?.[0] ?? "";
		// strip /* ... */ comments so we only assert against actual
		// declarations (the wave 33d migration note inside the block
		// names the prior values for context, but those are textual
		// references and shouldn't trigger this regression check).
		const bodyDecls = bodyBlock.replace(/\/\*[\s\S]*?\*\//g, "");
		expect(bodyDecls).not.toMatch(/#fdfcf8/);
		expect(bodyDecls).not.toMatch(/#fefcf8/);
		// pin the unified value
		expect(bodyDecls).toContain(
			"--color-background-input-default-ifz5bb: #faf7f0",
		);
		expect(bodyDecls).toContain(
			"--color-background-button-normal-default-7f99mv: #faf7f0",
		);
		expect(bodyDecls).toContain("--color-background-popover-e20fy8: #faf7f0");
	});

	it("featured-event light-mode marquee bg-from / bg-to is toned away from vibrant near-yellow", () => {
		// the marquee header lives in feed/styles.css and only had a
		// light-mode rule (dark mode uses indigo/violet). Pre-wave-33d:
		//   --cdn-marquee-bg-from: #fff5d6;  /* near-pure cream-yellow */
		//   --cdn-marquee-bg-to:   #f4d986;  /* saturated amber-yellow */
		// Post-wave-33d: softer, lower-saturation values.
		expect(feedCss).toContain("--cdn-marquee-bg-from: #f5ead0;");
		expect(feedCss).toContain("--cdn-marquee-bg-to: #e8c97a;");
		expect(feedCss).not.toContain("--cdn-marquee-bg-from: #fff5d6;");
		expect(feedCss).not.toContain("--cdn-marquee-bg-to: #f4d986;");
	});

	it("featured-event rizz spot tokens softened (~70% of prior alphas)", () => {
		// the rizz spotlight + bloom alphas pre-33d totalled 0.22 + 0.16 +
		// 0.22 + 0.28 across four tokens — too much warmth + violet on a
		// cream page. Pin the softened set.
		expect(feedCss).toContain(
			"--cdn-rizz-spot-warm: rgba(201, 162, 63, 0.15);",
		);
		expect(feedCss).toContain(
			"--cdn-rizz-spot-violet: rgba(144, 96, 240, 0.11);",
		);
		expect(feedCss).toContain(
			"--cdn-rizz-bloom-purple: rgba(90, 31, 138, 0.16);",
		);
	});
});
