// SPDX-License-Identifier: MIT-0
// Deterministically convert the validated API-format workflow into ComfyUI
// editor (UI) format. Widget order per node type is fixed to match ComfyUI's
// object_info input order (verified against the live :8188 instance).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const api = JSON.parse(
	readFileSync(join(dir, "cdn-composite.api.json"), "utf8"),
);

// link-typed inputs (in order) and widget inputs (in order) + output types per node type
const SPEC = {
	CheckpointLoaderSimple: {
		links: [],
		widgets: ["ckpt_name"],
		outs: ["MODEL", "CLIP", "VAE"],
	},
	CLIPTextEncode: {
		links: ["clip"],
		widgets: ["text"],
		outs: ["CONDITIONING"],
	},
	EmptyLatentImage: {
		links: [],
		widgets: ["width", "height", "batch_size"],
		outs: ["LATENT"],
	},
	KSampler: {
		links: ["model", "positive", "negative", "latent_image"],
		widgets: [
			"seed",
			"__ctrl",
			"steps",
			"cfg",
			"sampler_name",
			"scheduler",
			"denoise",
		],
		outs: ["LATENT"],
	},
	VAEDecode: { links: ["samples", "vae"], widgets: [], outs: ["IMAGE"] },
	LoadImage: {
		links: [],
		widgets: ["image", "__upload"],
		outs: ["IMAGE", "MASK"],
	},
	ImageBlur: {
		links: ["image"],
		widgets: ["blur_radius", "sigma"],
		outs: ["IMAGE"],
	},
	ImageScale: {
		links: ["image"],
		widgets: ["upscale_method", "width", "height", "crop"],
		outs: ["IMAGE"],
	},
	ImageBlend: {
		links: ["image1", "image2"],
		widgets: ["blend_factor", "blend_mode"],
		outs: ["IMAGE"],
	},
	ImageCompositeMasked: {
		links: ["destination", "source", "mask"],
		widgets: ["x", "y", "resize_source"],
		outs: ["IMAGE"],
	},
	InvertMask: { links: ["mask"], widgets: [], outs: ["MASK"] },
	SaveImage: { links: ["images"], widgets: ["filename_prefix"], outs: [] },
};

const ids = Object.keys(api).filter((k) => !k.startsWith("_"));
const nodes = [];
const links = [];
let linkId = 0;
let order = 0;
let col = 0;

for (const id of ids) {
	const node = api[id];
	const spec = SPEC[node.class_type];
	if (!spec) throw new Error(`no spec for ${node.class_type}`);
	const inputs = [];
	for (const name of spec.links) {
		const ref = node.inputs[name];
		if (!ref) continue; // optional link (e.g. mask) absent
		inputs.push({
			name,
			type: outType(api, ref[0], ref[1]),
			link: null,
			_ref: ref,
		});
	}
	const widgets_values = [];
	for (const w of spec.widgets) {
		if (w === "__ctrl") widgets_values.push("fixed");
		else if (w === "__upload") widgets_values.push("image");
		else widgets_values.push(node.inputs[w]);
	}
	nodes.push({
		id: Number(id),
		type: node.class_type,
		pos: [(col % 5) * 420, Math.floor(col / 5) * 320],
		size: [360, 200],
		flags: {},
		order: order++,
		mode: 0,
		inputs,
		outputs: spec.outs.map((t, i) => ({
			name: t.toLowerCase(),
			type: t,
			links: [],
			slot_index: i,
		})),
		properties: { "Node name for S&R": node.class_type },
		widgets_values,
	});
	col++;
}

function outType(g, nid, slot) {
	return SPEC[g[nid].class_type].outs[slot] || "*";
}

const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
for (const n of nodes) {
	for (const inp of n.inputs) {
		const [srcId, srcSlot] = inp._ref;
		linkId++;
		inp.link = linkId;
		byId[Number(srcId)].outputs[srcSlot].links.push(linkId);
		links.push([
			linkId,
			Number(srcId),
			srcSlot,
			n.id,
			n.inputs.indexOf(inp),
			inp.type,
		]);
		delete inp._ref;
	}
}

const ui = {
	last_node_id: Math.max(...nodes.map((n) => n.id)),
	last_link_id: linkId,
	nodes,
	links,
	groups: [],
	config: {},
	extra: {},
	version: 0.4,
};
writeFileSync(
	join(dir, "cdn-composite.ui.json"),
	`${JSON.stringify(ui, null, 2)}\n`,
);
console.log(
	`wrote cdn-composite.ui.json: ${nodes.length} nodes, ${links.length} links`,
);
