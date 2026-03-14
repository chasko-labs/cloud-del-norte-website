# DEC: Toggle Button CSS — Locale-Aware Selectors + Chrome Removal

**Date:** 2026-07-18
**Author:** Lyren
**Status:** ✅ Implemented

**Decision:** Fixed TopNavigation toggle button CSS in two ways:

1. **Button chrome removal:** Added `background: transparent !important; border: none !important; box-shadow: none !important` targeting `#top-nav [class*="utility-button"] button` and `button-trigger` to eliminate the square artifact behind emoji characters.

2. **Locale-aware CSS selectors:** Replaced English-only `[title*="..."]` selectors with dual-locale variants matching all actual title text from `en-US.json` and `es-MX.json`. Theme toggle matches `"light mode"` / `"dark mode"` / `"modo claro"` / `"modo oscuro"`. Locale toggle matches `"Spanish"` / `"Inglés"`.

**Rationale:** The old selectors were written pre-localization and matched only hardcoded English title substrings. After localization wiring (DEC-007), titles became dynamic via `t()`. The `[title*="English"]` / `[title*="Español"]` selectors were actually broken in BOTH locales since the actual titles are "Switch to Spanish" (EN) and "Cambiar a Inglés" (ES). The fix uses substring matches derived directly from translation JSON values.

**Affected files:** `src/layouts/shell/styles.css`
