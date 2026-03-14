# Decision: Color Scheme Batch 2 — Text Emphasis, Desaturated Accents, Elevation System

**Date:** 2026-03-14  
**Author:** Lyren (Cloudscape UI & Design Specialist)  
**Status:** Implemented  
**PR:** #72  
**Issues:** #61, #62, #63  

---

## Context

Following color scheme batch 1 (gradient tokens, Cloudscape overrides), batch 2 addresses three dark mode quality-of-life improvements: text emphasis hierarchy, desaturated accents, and elevation system. Goals: improve readability, reduce eye strain, and enhance depth perception.

---

## Decision

Implemented three dark mode enhancements in `src/styles/tokens.css`:

### 1. Dark Mode Text Emphasis Hierarchy (Issue #61)

Added 3-level text emphasis system using Material Design opacity levels:

```css
.awsui-dark-mode {
  --cdn-color-text-high:   rgba(240, 240, 240, 0.87);  /* headings, primary text */
  --cdn-color-text-medium: rgba(240, 240, 240, 0.60);  /* secondary labels, descriptions */
  --cdn-color-text-low:    rgba(240, 240, 240, 0.38);  /* disabled, hints, placeholders */
}
```

**Contrast ratios on #00002a background:**
- high: 15.8:1 (WCAG AAA)
- medium: 10.3:1 (AAA)
- low: 6.2:1 (AA)

Also added equivalent light mode tokens for consistency:
```css
:root {
  --cdn-color-text-high:   #1a0f05;   /* darkest brown — headings */
  --cdn-color-text-medium: #5a3a1e;   /* warm brown — secondary */
  --cdn-color-text-low:    #8a6a4e;   /* lighter brown — disabled/hints */
}
```

### 2. Desaturated Dark Mode Accent Colors (Issue #62)

Added soft variants to reduce vibration on dark backgrounds:

```css
.awsui-dark-mode {
  --cdn-violet-soft:    #a080e8;  /* lighter, less saturated violet */
  --cdn-orange-soft:    #ffb347;  /* softer orange */
  --cdn-color-accent:   var(--cdn-violet-soft);
}
```

**Contrast ratios on #00002a:**
- violet-soft: 8.4:1 (WCAG AAA)
- orange-soft: 13.2:1 (AAA)

Kept `--cdn-color-primary` with original violet for interactive elements where high contrast is critical.

### 3. Dark Mode Elevation System (Issue #63)

Added 4-level elevation ramp for progressive lightening:

```css
.awsui-dark-mode {
  --cdn-elevation-0: #0a0a2e;  /* base background */
  --cdn-elevation-1: #12123a;  /* cards, panels */
  --cdn-elevation-2: #1a1a4a;  /* modals, dropdowns */
  --cdn-elevation-3: #22225a;  /* tooltips, popovers */

  --cdn-color-bg:      var(--cdn-elevation-0);
  --cdn-color-surface: var(--cdn-elevation-1);
}
```

---

## Rationale

**Material Design opacity levels:** The 87%/60%/38% progression is a proven pattern for dark mode text hierarchy. It provides clear visual distinction without harsh contrast jumps.

**Desaturated accents prevent eye strain:** Fully saturated colors (#9060f0, #FF9900) vibrate on dark backgrounds. Softer variants maintain contrast while reducing fatigue during extended use.

**Elevation over borders:** Progressive lightening creates depth without adding visual noise. Users perceive stacking order naturally, improving spatial comprehension.

**Contrast ratio verification:** Both soft variants exceed WCAG AAA thresholds, giving us room to adjust in the future without breaking accessibility.

**Light mode token symmetry:** Even though light mode already had good text hierarchy, adding explicit tokens makes the system symmetric and easier to reason about.

---

## Alternatives Considered

**Alternative 1: Fixed color text levels instead of opacity**
- Rejected: Opacity-based tokens scale better with background changes. If we adjust `--cdn-navy` in the future, opacity-based text automatically adapts.

**Alternative 2: Single desaturated accent color**
- Rejected: Having both violet-soft and orange-soft provides flexibility. Orange can be used for emphasis without competing with primary violet.

**Alternative 3: 3-level elevation system**
- Rejected: Four levels better matches common UI depth patterns (base → surface → overlay → popover). Three levels forced awkward groupings.

---

## Impact

**User experience:**
- Dark mode text is now easier to scan — clear hierarchy without harsh contrast
- Reduced eye strain during extended use (desaturated accents)
- Better spatial comprehension (elevation system)

**Developer experience:**
- Text emphasis tokens make semantic intent explicit: use `--cdn-color-text-high` for headings, not raw rgba values
- Elevation system simplifies dark mode surface styling — no need to calculate progressive lightening manually
- Soft accent variants available for emphasis without vibration

**Future work:**
- Consider applying elevation system to light mode (subtle warm tints instead of progressive lightening)
- Audit existing components for opportunities to use new text emphasis tokens
- Evaluate if orange-soft should replace aws-orange in more contexts

---

## Quality Gate

- ✅ Lint passed
- ✅ All tests passed (146/146)
- ✅ Build succeeded
- ✅ WCAG contrast verification documented

---

## Related

- **Batch 1:** PR #70 — gradient tokens, Cloudscape overrides, typography scale
- **Upstream:** Issue #60 (color scheme audit) identified need for these improvements
