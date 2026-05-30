# CDN graphics-pipeline — Iteration 0

Canonical image-generation pipeline for Cloud Del Norte. The brand mark is
**composited, never generated**: SDXL paints only the background atmosphere
constrained to the CDN palette; the canonical logo raster is overlaid on top.

## Locked architecture

1. Rasterize `lib/brand/logo.svg` (viewBox 1024×1024, 353 paths, 3 arms + 12
   bulbs, `cdn-bulb-glow` + `cdn-arm-glow` filters) at target resolution — fixed
   overlay, no warp/skew/perspective, arms/bulbs never detached or recomposed.
2. Apply the glow filters in image space (gaussian blur + screen/add composite).
3. Generate the background atmosphere with SDXL, prompt-locked to the palette
   hexes (Ben-Day dot field, newspaper grain, dark vignette, cream→lavender→
   violet→navy gradient, World's-Fair mid-century-futurist geometry).
4. Composite the sharp logo over the atmosphere using its own alpha as mask.
5. Export at wallpaper (2560×1440, 3840×2160) and mobile (1290×2796).

"Variate within guardrails" = change the atmosphere + glow only (KSampler seed,
node `5`). **Never** vary the logo paths.

## Files

- `render-logo.mjs` — deterministic raster of the canonical mark via
  `rsvg-convert` (filter-accurate) + `sharp` (centered, aspect preserved).
  Output → `renders/`.
- `renders/` — committed canonical logo rasters (transparent PNG, RGBA):
  `cdn-logo-2560x1440.png`, `cdn-logo-3840x2160.png`, `cdn-logo-1290x2796.png`.
- `cdn-composite.api.json` — ComfyUI **API/prompt** format. Submit to
  `POST /prompt`. `_comment` keys document intent; strip keys starting with `_`
  before submitting.
- `cdn-composite.ui.json` — ComfyUI **editor** format. Drag onto the canvas.
- `api-to-ui.mjs` — regenerates the UI file from the API file.

## Reproduce

```sh
node graphics-pipeline/render-logo.mjs          # produce logo rasters
# upload rasters to ComfyUI input:
curl -F image=@graphics-pipeline/renders/cdn-logo-2560x1440.png -F overwrite=true http://127.0.0.1:8188/upload/image
curl -F image=@graphics-pipeline/renders/cdn-logo-1290x2796.png -F overwrite=true http://127.0.0.1:8188/upload/image
# submit (strip _comment keys first), or open cdn-composite.ui.json in the editor
```

## Environment (verified 2026-05-29, host rocm-aibox)

- ComfyUI at `http://127.0.0.1:8188`, install `/home/hs-shannon/ComfyUI`.
- Only model: `checkpoints/sd_xl_base_1.0.safetensors` + `vae/sdxl_vae.safetensors`.
- No ControlNet, no LoRAs — diffusion cannot reliably reproduce the logo
  geometry, which is why the mark is composited rather than generated.
- All composite nodes used (`LoadImage`, `ImageScale`, `ImageBlur`, `ImageBlend`,
  `ImageCompositeMasked`, `InvertMask`, `SaveImage`) confirmed present.
- The API workflow was submitted and **accepted with zero node errors**
  (validated server-side). A full generation run was started but the shared
  ComfyUI instance went unreachable mid-run before output was retrieved;
  rendered backgrounds were not captured in this iteration.
