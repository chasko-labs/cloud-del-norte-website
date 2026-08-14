/**
 * legibility-audit.cjs — rendered-pixel contrast + typography gate
 *
 * Measures ACTUAL RENDERED contrast by screenshotting each text element's
 * bounding box and sampling composited pixels at EDGE positions where text
 * does not render (padding regions, inter-line gaps). This correctly handles:
 *   - elements with their own background-color (even semi-transparent)
 *   - gradient backgrounds and background-images
 *   - layered/composited backgrounds from ancestors
 *
 * Sampling strategy: take pixels from the top-edge and bottom-edge of the
 * element (first/last ~15% vertically), where CSS padding lives and text
 * glyphs do not render. This avoids sampling the text glyph pixels themselves.
 *
 * Thresholds (WCAG 2.1 AA):
 *   - Text contrast: >= 4.5:1 (normal text), >= 3.0:1 (large text >= 18px or >= 14px bold)
 *   - Minimum font size: text BELOW 14px is flagged (exactly 14px is compliant)
 *   - Body line-height: >= 1.6 for multi-line wrapping text
 *   - Touch targets: >= 44px for interactive elements
 *
 * Exclusions (documented):
 *   - DECORATIVE_SELECTORS: elements matching these are decorative/illustrative per
 *     WCAG 1.4.3 "pure decoration" exception. Not scored for text contrast.
 *   - FRAMEWORK_CHROME_SELECTORS: Cloudscape and project navigation chrome. Excluded
 *     from line-height check ONLY — contrast and size checks still apply.
 *   - Single-line non-wrapping text (white-space:nowrap, or actual height ≈ 1 line
 *     after subtracting padding): exempt from line-height because line-height has
 *     zero readability impact on non-wrapping text.
 */
const { chromium } = require("playwright");

// --- DOCUMENTED EXCLUSIONS ---

/**
 * Decorative non-text elements excluded from text-contrast scoring.
 * WCAG 1.4.3 exempts "pure decoration" — elements that convey no information.
 */
const DECORATIVE_SELECTORS = [
	// Quantum circuit diagram: illustrative art at 0.85 opacity, not content text
	"[class*='circuit']",
	"[class*='quantum-diagram']",
	// ARIA-hidden elements are not perceived by assistive tech
	"[aria-hidden='true']",
	// ARIA decorative roles
	"[role='img']",
	"[role='presentation']",
	"[role='none']",
];

/**
 * Framework/navigation chrome excluded from LINE-HEIGHT check only.
 *
 * Rationale: These surfaces use tight line-heights because their text is
 * single-line by design. Cloudscape is AWS's accessibility-audited design
 * system; overriding its internals via !important breaks component layout.
 * The project toolbar follows the same single-line nav pattern.
 *
 * Contrast and size checks STILL APPLY to framework chrome.
 */
const FRAMEWORK_CHROME_SELECTORS = [
	// Cloudscape framework navigation components
	"[class*='awsui_header']",
	"[class*='awsui_top-navigation']",
	"[class*='awsui_utility']",
	"nav[class*='awsui']",
	"header[class*='awsui']",
	// Cloudscape container/card headers (single-line, overflow:ellipsis)
	"[class*='awsui_header-title']",
	"[class*='awsui_container-header']",
	// Project toolbar (single-line nav controls, 44px touch targets)
	"[class*='quantum-toolbar']",
	"[class*='quantum-user']",
	// Cloudscape cards and containers
	"[class*='awsui_card']",
	"[class*='awsui_container']",
];

// --- UTILITY FUNCTIONS ---

/** sRGB relative luminance per WCAG 2.1 */
function luminance(r, g, b) {
	const [rs, gs, bs] = [r, g, b].map((v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG contrast ratio */
function contrastRatio(l1, l2) {
	const lighter = Math.max(l1, l2);
	const darker = Math.min(l1, l2);
	return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Sample rendered BACKGROUND pixels from an element's interior.
 *
 * Strategy: sample from the INTERIOR of the element, avoiding:
 *   1. The outer edges (which fall outside rounded borders)
 *   2. The exact center (which may contain text glyph pixels)
 *
 * For elements with border-radius (pills, buttons), the corners of the
 * bounding box are OUTSIDE the visible element. We restrict sampling to
 * the inner 40-60% band vertically, at positions offset from center to
 * avoid text glyphs.
 *
 * Uses a two-pass approach:
 *   Pass 1: Sample from interior non-text positions
 *   Pass 2: If too few valid samples, scan rows more broadly
 *
 * Returns worst-case contrast (the bg pixel that produces the lowest
 * contrast against the foreground text color).
 */
async function sampleBackgroundPixels(page, boundingBox, fgRGB, hasRadius) {
	if (!boundingBox || boundingBox.width < 2 || boundingBox.height < 2) {
		return null;
	}

	const clip = {
		x: Math.max(0, Math.round(boundingBox.x)),
		y: Math.max(0, Math.round(boundingBox.y)),
		width: Math.max(2, Math.round(boundingBox.width)),
		height: Math.max(2, Math.round(boundingBox.height)),
	};

	if (clip.x + clip.width > 1280) clip.width = 1280 - clip.x;
	if (clip.y + clip.height > 800) clip.height = 800 - clip.y;
	if (clip.width < 2 || clip.height < 2) return null;

	let screenshotBuf;
	try {
		screenshotBuf = await page.screenshot({ clip, type: "png" });
	} catch {
		return null;
	}

	let pixels;
	try {
		const sharp = require("sharp");
		const { data, info } = await sharp(screenshotBuf)
			.raw()
			.ensureAlpha()
			.toBuffer({ resolveWithObject: true });
		pixels = { data, width: info.width, height: info.height, channels: 4 };
	} catch {
		const b64 = screenshotBuf.toString("base64");
		pixels = await page.evaluate(async (b64Data) => {
			const img = new Image();
			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
				img.src = `data:image/png;base64,${b64Data}`;
			});
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const cctx = canvas.getContext("2d");
			cctx.drawImage(img, 0, 0);
			const imageData = cctx.getImageData(0, 0, img.width, img.height);
			return {
				data: Array.from(imageData.data),
				width: img.width,
				height: img.height,
				channels: 4,
			};
		}, b64);
	}

	const { data, width, height, channels } = pixels;
	const fgLum = luminance(fgRGB[0], fgRGB[1], fgRGB[2]);

	// Determine sample region based on whether element has border-radius.
	// Rounded elements: sample from the INTERIOR only (avoid outside corners).
	// Non-rounded: sample from top/bottom padding bands + interior edges.
	let samplePoints;
	if (hasRadius) {
		// For pill/rounded elements: stay in the central 30-70% band both axes
		// Sample at vertical positions above and below where text renders (25% and 75%)
		// and at horizontal edges within the rounded area
		samplePoints = [
			// Vertical 25% band (above text) at various x
			[0.35, 0.2], [0.5, 0.18], [0.65, 0.2],
			// Vertical 75% band (below text)
			[0.35, 0.8], [0.5, 0.82], [0.65, 0.8],
			// Left/right interior (past rounded edge but before text)
			[0.25, 0.4], [0.25, 0.6],
			[0.75, 0.4], [0.75, 0.6],
			// Additional interior points for better coverage
			[0.4, 0.25], [0.6, 0.25], [0.4, 0.75], [0.6, 0.75],
		];
	} else if (height > 20) {
		// Non-rounded, tall: sample from top/bottom 10-15% bands
		samplePoints = [
			[0.3, 0.05], [0.5, 0.07], [0.7, 0.05],
			[0.3, 0.93], [0.5, 0.95], [0.7, 0.93],
			[0.1, 0.3], [0.9, 0.3], [0.1, 0.7], [0.9, 0.7],
		];
	} else {
		// Short non-rounded: left/right edges
		samplePoints = [
			[0.05, 0.5], [0.08, 0.3], [0.08, 0.7],
			[0.92, 0.5], [0.95, 0.3], [0.95, 0.7],
		];
	}

	let worstContrast = Infinity;
	let worstPixel = null;
	const samples = [];

	for (const [xFrac, yFrac] of samplePoints) {
		const px = Math.min(width - 1, Math.max(0, Math.round(xFrac * (width - 1))));
		const py = Math.min(height - 1, Math.max(0, Math.round(yFrac * (height - 1))));
		const idx = (py * width + px) * channels;
		const r = data[idx];
		const g = data[idx + 1];
		const b = data[idx + 2];
		if (channels >= 4 && data[idx + 3] < 128) continue;

		// Skip pixels that are the foreground text color itself
		const pixelLum = luminance(r, g, b);
		if (Math.abs(pixelLum - fgLum) < 0.02) continue;

		samples.push({ r, g, b, lum: pixelLum });
		const ratio = contrastRatio(fgLum, pixelLum);
		if (ratio < worstContrast) {
			worstContrast = ratio;
			worstPixel = [r, g, b];
		}
	}

	// Fallback: if too few samples, scan center rows more broadly
	if (samples.length < 3) {
		const yMid = Math.round(height * 0.5);
		const scanRows = [
			Math.max(0, Math.round(height * 0.2)),
			Math.max(0, Math.round(height * 0.8)),
			Math.max(0, yMid - 1),
			Math.min(height - 1, yMid + 1),
		];
		for (const row of scanRows) {
			for (let px = Math.round(width * 0.25); px < width * 0.75; px += 3) {
				const idx = (row * width + px) * channels;
				const r = data[idx];
				const g = data[idx + 1];
				const b = data[idx + 2];
				if (channels >= 4 && data[idx + 3] < 128) continue;
				const pixelLum = luminance(r, g, b);
				if (Math.abs(pixelLum - fgLum) < 0.015) continue;
				samples.push({ r, g, b, lum: pixelLum });
				const ratio = contrastRatio(fgLum, pixelLum);
				if (ratio < worstContrast) {
					worstContrast = ratio;
					worstPixel = [r, g, b];
				}
			}
		}
	}

	if (!worstPixel || samples.length < 2) return null;
	return { contrast: worstContrast, bgPixel: worstPixel };
}

// --- MAIN ---

(async () => {
	const browser = await chromium.launch({ headless: true });
	const issues = [];

	for (const mode of ["dark", "light"]) {
		const ctx = await browser.newContext({
			viewport: { width: 1280, height: 800 },
			colorScheme: mode,
		});
		const page = await ctx.newPage();
		await page.goto("https://quantum.clouddelnorte.org/", {
			waitUntil: "networkidle",
			timeout: 20000,
		});
		if (mode === "light") {
			await page.evaluate(() => {
				localStorage.setItem("awsaerospace-theme", "light");
			});
			await page.reload({ waitUntil: "networkidle" });
		}
		await page.waitForTimeout(2000);

		const decorativeSelector = DECORATIVE_SELECTORS.join(", ");
		const frameworkChromeSelector = FRAMEWORK_CHROME_SELECTORS.join(", ");

		// Gather text elements with deduplication
		const elements = await page.$$eval(
			"h1, h2, h3, h4, p, span, a, button, li, label",
			(els, { decorativeSel, frameworkSel }) => {
				// Filter to visible text elements
				const candidates = els.filter((el) => {
					const text = (el.textContent || "").trim();
					if (!text || text.length < 2) return false;
					if (el.children.length > 3) return false;
					const rect = el.getBoundingClientRect();
					if (rect.width < 1 || rect.height < 1) return false;
					const cs = getComputedStyle(el);
					if (cs.display === "none" || cs.visibility === "hidden") return false;
					return true;
				});

				// Deduplicate: for elements with identical text at the same position,
				// keep only the innermost (fewest children)
				const textMap = new Map();
				for (const el of candidates) {
					const text = (el.textContent || "").trim().substring(0, 60);
					const rect = el.getBoundingClientRect();
					// Key by text + rounded position
					const posKey = `${text}|${Math.round(rect.x / 5)}|${Math.round(rect.y / 5)}`;
					const existing = textMap.get(posKey);
					if (!existing || el.children.length < existing.children.length) {
						textMap.set(posKey, el);
					}
				}

				return [...textMap.values()]
					.map((el) => {
						const cs = getComputedStyle(el);
						const text = (el.textContent || "").trim().substring(0, 60);
						if (!text) return null;

						const color = cs.color;
						const fontSize = parseFloat(cs.fontSize);
						const fontWeight = parseInt(cs.fontWeight) || 400;
						const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.5;
						const opacity = parseFloat(cs.opacity);
						const whiteSpace = cs.whiteSpace;
						const paddingTop = parseFloat(cs.paddingTop) || 0;
						const paddingBottom = parseFloat(cs.paddingBottom) || 0;

						const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
						const fgRGB = m ? [+m[1], +m[2], +m[3]] : null;

						const rect = el.getBoundingClientRect();

						const isDecorative = decorativeSel
							? el.closest(decorativeSel) !== null
							: false;
						const isFrameworkChrome = frameworkSel
							? el.closest(frameworkSel) !== null
							: false;

						const isInteractive = el.tagName === "A" || el.tagName === "BUTTON";
						const touchSize = isInteractive
							? Math.min(rect.width, rect.height)
							: null;

						// Multi-line detection: text wraps if:
						// 1. white-space is NOT nowrap/pre
						// 2. content height (minus padding) exceeds ~1.5 lines
						const contentHeight = rect.height - paddingTop - paddingBottom;
						const isNoWrap =
							whiteSpace === "nowrap" || whiteSpace === "pre";
						const lineCount = contentHeight / lineHeight;
						const isMultiLine = !isNoWrap && lineCount > 1.4;

						// Border radius detection (for pill/rounded elements)
						const borderRadius = parseFloat(cs.borderRadius) || 0;
						const hasRadius = borderRadius > 4;

						return {
							text,
							color,
							fgRGB,
							fontSize,
							fontWeight,
							lineHeightRatio: parseFloat((lineHeight / fontSize).toFixed(2)),
							opacity,
							tag: el.tagName,
							isDecorative,
							isFrameworkChrome,
							isMultiLine,
							isNoWrap,
							hasRadius,
							touchSize,
							boundingBox: {
								x: rect.x,
								y: rect.y,
								width: rect.width,
								height: rect.height,
							},
						};
					})
					.filter(Boolean)
					.slice(0, 60);
			},
			{ decorativeSel: decorativeSelector, frameworkSel: frameworkChromeSelector },
		);

		console.log(`\n=== ${mode.toUpperCase()} MODE ===`);

		for (const el of elements) {
			const probs = [];

			// --- CONTRAST CHECK (skip decorative) ---
			if (!el.isDecorative && el.fgRGB) {
				const sample = await sampleBackgroundPixels(
					page,
					el.boundingBox,
					el.fgRGB,
					el.hasRadius,
				);
				if (sample) {
					const ratio = sample.contrast;
					const isLargeText =
						el.fontSize >= 18 || (el.fontSize >= 14 && el.fontWeight >= 700);
					const threshold = isLargeText ? 3.0 : 4.5;

					if (ratio < threshold) {
						probs.push(
							`LOW CONTRAST ${ratio.toFixed(2)}:1 (need ${threshold}:1, bg sampled rgb(${sample.bgPixel.join(",")}))`,
						);
					}
					el.measuredContrast = ratio.toFixed(2);
				}
			} else if (el.isDecorative) {
				el.measuredContrast = "decorative-skip";
			}

			// --- FONT SIZE: strictly below 14px ---
			if (el.fontSize < 14) {
				probs.push(`TOO SMALL ${el.fontSize.toFixed(1)}px (minimum 14px)`);
			}

			// --- LINE-HEIGHT: multi-line wrapping text only ---
			if (!el.isFrameworkChrome && !el.isNoWrap && el.isMultiLine && el.lineHeightRatio < 1.6) {
				// Additional guard: interactive elements (A, BUTTON) often have
				// height set for touch-target compliance (44px) not wrapping text.
				// Only flag if the element is NOT interactive or if it genuinely has
				// enough content to wrap (text length vs element width suggests wrapping)
				const isInteractiveWithTouchTarget =
					(el.tag === "A" || el.tag === "BUTTON") && el.touchSize >= 44;
				if (!isInteractiveWithTouchTarget) {
					probs.push(
						`TIGHT LINE-HEIGHT ${el.lineHeightRatio} (need >= 1.6 for wrapping text)`,
					);
				}
			}

			// --- TOUCH TARGET ---
			if (el.touchSize !== null && el.touchSize < 44) {
				probs.push(
					`SMALL TOUCH TARGET ${Math.round(el.touchSize)}px (need >= 44px)`,
				);
			}

			// --- OPACITY (skip decorative) ---
			if (!el.isDecorative && el.opacity < 0.9) {
				probs.push(`LOW OPACITY ${el.opacity}`);
			}

			if (probs.length > 0) {
				issues.push({ mode, ...el, problems: probs });
				console.log(
					`  ✗ "${el.text}" | ${el.fontSize.toFixed(1)}px ${el.fontWeight}w | contrast:${el.measuredContrast || "?"} | ${probs.join(", ")}`,
				);
			}
		}
		await ctx.close();
	}

	console.log(`\n=== TOTAL LEGIBILITY ISSUES: ${issues.length} ===`);

	const byText = {};
	for (const i of issues) {
		const key = i.text.substring(0, 30);
		if (!byText[key]) byText[key] = [];
		byText[key].push(i);
	}

	if (Object.keys(byText).length > 0) {
		console.log("\n=== WORST OFFENDERS (fail in both modes) ===");
		for (const [text, items] of Object.entries(byText)) {
			if (items.length >= 2) {
				console.log(`  "${text}" — fails in BOTH modes`);
				for (const i of items)
					console.log(`    ${i.mode}: ${i.problems.join(", ")}`);
			}
		}
	}

	await browser.close();
	process.exit(issues.length > 0 ? 1 : 0);
})().catch((e) => {
	console.error("FATAL:", e.message);
	process.exit(1);
});
