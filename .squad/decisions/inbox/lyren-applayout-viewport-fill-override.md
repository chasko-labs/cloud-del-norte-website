# DEC: AppLayout viewport-fill override

**Author:** Lyren  
**Date:** 2025-07-19  
**Status:** Implemented  
**Scope:** `src/layouts/shell/styles.css`

## Context

Cloudscape AppLayout sets inline `min-block-size: calc(100vh - headerHeight)` on the layout and `block-size` on containers. With Footer rendering outside AppLayout (required since `footerSelector` collapses the sidebar), this creates a giant whitespace gap.

## Decision

Override Cloudscape's viewport-fill inline styles with CSS `!important`:
- `min-block-size: auto` on the layout `<main>`
- `block-size: auto` on nav/content/tools containers

## Constraints

- Do NOT re-add `footerSelector` — it causes sidebar to collapse to near-zero when footer is ~1118px tall.
- `!important` is required because Cloudscape applies these as inline styles via JS.
- The selectors use `[class*="awsui_layout"]` which may need updating if Cloudscape changes its class naming convention in a major version bump.

## Affected Agents

- **Vael** — Build pipeline unaffected, but aware of the CSS override pattern.
- **Kess** — No test changes needed; existing tests pass.
