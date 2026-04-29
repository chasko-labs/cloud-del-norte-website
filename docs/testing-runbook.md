# cloud del norte testing runbook

how to test this site end-to-end from rocm-aibox without claude-in-chrome.

## quick recipe — verify a CSS change visually

```bash
# 1. build
cd ~/code/chasko-labs/cloud-del-norte-website
bun run build

# 2. deploy to dev first
aws s3 sync lib/ s3://dev.clouddelnorte.org/ \
  --exclude "liora/*" --exclude "liora-embed/*" --delete \
  --profile aerospaceug-admin

INV=$(aws cloudfront create-invalidation \
  --distribution-id EEHVTUEQ97V0X --paths "/*" \
  --profile aerospaceug-admin --query 'Invalidation.Id' --output text)

# 3. wait for CF
until aws cloudfront get-invalidation --distribution-id EEHVTUEQ97V0X \
  --id $INV --profile aerospaceug-admin 2>&1 | grep -q '"Status": "Completed"'; do
  sleep 5
done

# 4. verify with playwright + chrome for testing
node /tmp/liora-pixel-sample.mjs   # or any other verifier
```

## chrome for testing pattern

stock chromium on this box doesn't get WebGL — Babylon.js never mounts, status checks pass but the visual scene is broken. always use chrome for testing + xvfb display :99 + EGL gpu flag:

```js
import { chromium } from "/home/bryanchasko/code/chasko-labs/sumerian-hosts/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  executablePath: "/opt/chrome-for-testing/chrome-linux64/chrome",
  headless: false,
  env: { ...process.env, DISPLAY: ":99" },
  args: [
    "--no-sandbox",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=egl",
  ],
});
```

if `:99` is not running:

```bash
Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 &
```

full doc: `~/code/heraldstack/shannon-claude-code-cli/docs/liora-end-to-end-testing.md`

## environments

| env  | bucket                      | cloudfront                            | profile           |
| ---- | --------------------------- | ------------------------------------- | ----------------- |
| prod | s3://awsaerospace.org/      | ECC3LP1BL2CZS (clouddelnorte.org)     | aerospaceug-admin |
| dev  | s3://dev.clouddelnorte.org/ | EEHVTUEQ97V0X (dev.clouddelnorte.org) | aerospaceug-admin |

aws account: 211125425201 (chasko-labs / aerospaceug)

## CRITICAL — exclude liora/ and liora-embed/ on every sync

```bash
aws s3 sync lib/ s3://awsaerospace.org/ \
  --exclude "liora/*" --exclude "liora-embed/*" --delete \
  --profile aerospaceug-admin
```

**why**: those paths are deployed by the chasko-labs/sumerian-hosts woodpecker pipeline. syncing the cdn site without those excludes will wipe the embed bundle. recovery is a manual deploy from `~/code/chasko-labs/sumerian-hosts/dist/liora-embed/` and `dist/liora-assets/`.

## verifier scripts

three scripts in `/tmp/` you can re-run anytime. recreate from `docs/liora-end-to-end-testing.md` in shannon-claude-code-cli if missing.

| script                     | purpose                                                                          |
| -------------------------- | -------------------------------------------------------------------------------- |
| `liora-verify-fix.mjs`     | full smoke: status bar height, font, tap-1/2/3 progression, credits DOM presence |
| `liora-pixel-sample.mjs`   | regression: rgb pixel at panel center across tap states                          |
| `liora-credits-review.mjs` | 16-frame capture across 32s credits cycle                                        |

## known regressions to watch for

documented in shannon-claude-code-cli memory + the cross-repo doc. tldr:

| symptom                                           | likely cause                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| liora panel blank/empty                           | `display:none` somewhere on `#liora-canvas` — collapses to 0×0, blocks babylon mount         |
| status bar shows as 2px hairline                  | legacy `#liora-status-bar{height:2px}` ID-selector overriding navigation/liora.css           |
| yellow background behind credits                  | canvas not hidden at screen-tap-3; babylon engine.dispose() resets inline style              |
| credits text rendered with stretched/skewed lines | perspective + preserve-3d on .liora-credits matrix3d skew at small font                      |
| home page header band white instead of cream      | Cloudscape renamed `awsui_header-background` to `awsui_background_*` — selector needs update |
| mouseover flicker on cards                        | Cloudscape Container's `transition: all` fighting cdn-card !important overrides              |

## why claude-in-chrome MCP is not used

repeated session-start failures on this box, dialog blocks, and tab-id staleness. the chrome-for-testing + xvfb pattern is reliable across sessions and reproducible from this doc.

## cross-references

- `~/code/heraldstack/shannon-claude-code-cli/docs/liora-end-to-end-testing.md` — full testing recipe with findings log
- `~/code/chasko-labs/sumerian-hosts/docs/liora-embed-deploy.md` — embed deploy runbook
- `~/code/chasko-labs/sumerian-hosts/docs/host-page-testing.md` — testing the embed against host pages
