#!/usr/bin/env bash
# build-favicon-ico.sh — rasterize public/favicon.svg into favicon.ico (16/32/48)
# and apple-touch-icon.png (180). Uses Python + PIL because rocm-aibox lacks
# imagemagick / inkscape / rsvg-convert. The raster star geometry is
# hand-drawn here (no SVG parsing) — keep in sync with public/favicon.svg.
#
# usage: bash scripts/build-favicon-ico.sh
set -euo pipefail

cd "$(dirname "$0")/.."

python3 - <<'PY'
import math
from PIL import Image, ImageDraw, ImageFilter

PUBLIC = "public"

# brand palette
NAVY      = (0x00, 0x00, 0x2a, 255)
AMBER     = (0x8b, 0x5a, 0x2b, 255)
AWS_ORANGE= (0xff, 0x99, 0x00, 255)
VIOLET    = (0x90, 0x60, 0xf0)        # halo (alpha applied separately)
MAHOGANY  = (0x2c, 0x12, 0x06, 255)   # star outline


def star_points(cx: float, cy: float, r_outer: float, r_inner: float, rotation_deg: float = -90):
    """5-pointed star vertex list (10 points, alternating outer/inner)."""
    pts = []
    for i in range(10):
        angle = math.radians(rotation_deg + i * 36)
        r = r_outer if i % 2 == 0 else r_inner
        pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    return pts


def vertical_gradient(size, top_rgba, bot_rgba):
    """RGBA strip top→bottom gradient at given (w, h)."""
    w, h = size
    img = Image.new("RGBA", size)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = round(top_rgba[0] * (1 - t) + bot_rgba[0] * t)
        g = round(top_rgba[1] * (1 - t) + bot_rgba[1] * t)
        b = round(top_rgba[2] * (1 - t) + bot_rgba[2] * t)
        a = round(top_rgba[3] * (1 - t) + bot_rgba[3] * t)
        for x in range(w):
            px[x, y] = (r, g, b, a)
    return img


def render(size: int) -> Image.Image:
    """Render the favicon at `size` px. Supersample 4x for clean edges."""
    SS = 4
    W = size * SS
    H = size * SS

    # rounded-rect navy background
    bg = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    radius = round(W * (5 / 32))
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=radius, fill=NAVY)

    # violet halo — soft radial centered slightly above middle
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    halo_cx = W * 0.5
    halo_cy = H * (15 / 32)
    halo_r = W * (13 / 32)
    # build radial as concentric circles with decreasing alpha
    steps = 28
    for i in range(steps, 0, -1):
        t = i / steps
        # mirrors svg gradient: 0→0.55a, 0.55→0.12a, 1→0
        if t <= 0.55:
            alpha = 0.55 * (1 - t / 0.55) + 0.12 * (t / 0.55)
        else:
            alpha = 0.12 * (1 - (t - 0.55) / 0.45)
        a = int(alpha * 255)
        r = halo_r * t
        hd.ellipse(
            (halo_cx - r, halo_cy - r, halo_cx + r, halo_cy + r),
            fill=(VIOLET[0], VIOLET[1], VIOLET[2], a),
        )
    halo = halo.filter(ImageFilter.GaussianBlur(radius=W * 0.025))
    bg = Image.alpha_composite(bg, halo)

    # mask out halo to stay inside the rounded rect
    clip = Image.new("L", (W, H), 0)
    cd = ImageDraw.Draw(clip)
    cd.rounded_rectangle((0, 0, W - 1, H - 1), radius=radius, fill=255)
    bg.putalpha(Image.eval(clip, lambda v: v))  # forces alpha to clip
    # (Image.alpha_composite already preserved alpha; reapply clip to be safe)

    # star geometry — same proportions as favicon.svg
    cx = W * 0.5
    cy = H * (15.5 / 32)
    r_outer = W * (13 / 32)
    r_inner = r_outer * 0.42  # matches svg point math (≈12.73 inner-ring x at 16-cx, 32 viewport)
    pts = star_points(cx, cy, r_outer, r_inner, rotation_deg=-90)

    # gradient-filled star — draw star mask, paste vertical-gradient swatch, then outline
    star_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(star_mask).polygon(pts, fill=255)

    grad = vertical_gradient((W, H), AWS_ORANGE, AMBER)
    star_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    star_layer.paste(grad, (0, 0), star_mask)

    out = Image.alpha_composite(bg, star_layer)

    # outline (mahogany) — only at sizes where a stroke survives downsample
    if size >= 24:
        od = ImageDraw.Draw(out)
        stroke_w = max(1, round(W * (0.6 / 32)))
        od.polygon(pts, outline=MAHOGANY, width=stroke_w)

    # downsample to target
    return out.resize((size, size), Image.LANCZOS)


# ico: 16, 32, 48 multi-resolution. Pillow's ICO writer can downsample from a
# single large image given `sizes=`, but quality is best when each resolution
# is rendered fresh. Render the largest, then ask Pillow to embed all sizes.
ico_sizes = [(48, 48), (32, 32), (16, 16)]
ico_path = f"{PUBLIC}/favicon.ico"
render(48).save(ico_path, format="ICO", sizes=ico_sizes)
print(f"wrote {ico_path}")

# apple-touch-icon: 180x180 png
ati = render(180)
ati_path = f"{PUBLIC}/apple-touch-icon.png"
ati.save(ati_path, format="PNG", optimize=True)
print(f"wrote {ati_path}")

# apple-touch-icon-512: 512x512 png — high-res variant fed into MediaSession
# artwork[] for Android lockscreen full-screen art + iOS 16+ tap-to-expand.
# Same star/halo geometry, just a larger raster so the OS has source data
# above the 180px lockscreen-thumbnail tier
ati512 = render(512)
ati512_path = f"{PUBLIC}/apple-touch-icon-512.png"
ati512.save(ati512_path, format="PNG", optimize=True)
print(f"wrote {ati512_path}")
PY

echo "favicon raster build complete"
