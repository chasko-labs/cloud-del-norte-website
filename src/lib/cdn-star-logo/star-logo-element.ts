// <cdn-star-logo> — embeddable web component wrapping StarScene.
//
// Usage:
//   <cdn-star-logo></cdn-star-logo>
//   <cdn-star-logo transparent></cdn-star-logo>
//   <cdn-star-logo style="width: 240px; height: 240px;"></cdn-star-logo>
//
// Attributes:
//   transparent  — render with alpha:0 background instead of brand navy
//   no-rotate    — disable idle rotation
//
// The component sizes itself to its host element via CSS (default 100% / 100%).

import { StarScene } from "./StarScene.js";

const TEMPLATE_STYLE = `
:host {
	display: block;
	width: 100%;
	height: 100%;
	min-width: 64px;
	min-height: 64px;
	contain: strict;
}
canvas {
	display: block;
	width: 100%;
	height: 100%;
	outline: none;
	touch-action: none;
}
`;

export class CdnStarLogoElement extends HTMLElement {
	private canvas: HTMLCanvasElement | null = null;
	private scene: StarScene | null = null;
	private resizeObserver: ResizeObserver | null = null;

	static get observedAttributes(): string[] {
		return ["transparent", "no-rotate"];
	}

	connectedCallback(): void {
		const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
		root.innerHTML = `<style>${TEMPLATE_STYLE}</style><canvas></canvas>`;
		this.canvas = root.querySelector("canvas");
		if (!this.canvas) return;

		this.scene = new StarScene(this.canvas, {
			transparentBackground: this.hasAttribute("transparent"),
			autoRotate: !this.hasAttribute("no-rotate"),
		});

		this.resizeObserver = new ResizeObserver(() => this.scene?.resize());
		this.resizeObserver.observe(this);
	}

	disconnectedCallback(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.scene?.dispose();
		this.scene = null;
		this.canvas = null;
	}
}

if (!customElements.get("cdn-star-logo")) {
	customElements.define("cdn-star-logo", CdnStarLogoElement);
}
