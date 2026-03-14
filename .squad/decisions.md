# Decisions

> Team-wide decision log. Scribe merges entries from `.squad/decisions/inbox/`. Agents read this before every task.

---

## DEC-001: Squad Team Established

**Date:** 2026-03-13
**Author:** Stratia
**Status:** ✅ Accepted

**Decision:** Squad v0.5.4 team infrastructure created with HeraldStack personas. Team: Stratia (architecture), Lyren (Cloudscape UI), Vael (build/deploy), Theren (content/data), Kess (testing), Scribe (logger), Ralph (monitor).

**Rationale:** Project needs domain-specialized agent routing. HeraldStack personas consistent with Bryan's other projects (chrome-extension-moodle-uploader-v3). Roles map to project domains: Cloudscape components, Vite MPA build, content/data, and testing.

---

## DEC-002: MCP Server Selection

**Date:** 2026-03-13
**Author:** Stratia
**Status:** ✅ Accepted

**Decision:** Three MCP servers configured: github (Copilot MCP), context7 (library docs), fetch (web fetch). No chrome-devtools, playwright, jaeger, or AWS-specific MCPs.

**Rationale:** This is a static Cloudscape website — no Chrome extension debugging, no E2E browser testing, no observability infrastructure, no CDK/IaC. The three selected MCPs cover: code/PR operations (github), Cloudscape/React/Vite docs (context7), and live documentation fetch (fetch).

---

## DEC-003: Architectural Constraints Inherited

**Date:** 2026-03-13
**Author:** Stratia
**Status:** ✅ Accepted

**Decision:** All constraints from AGENTS.md are binding on the Squad team: MPA-only, no React Router, Cloudscape-only, no path aliases, no backend, ESLint flat config, manual deploy.

**Rationale:** These constraints predate Squad installation and are documented in the project's AGENTS.md. They are non-negotiable architectural decisions made by the project owner.

---

## DEC-004: Leader Schema Extended with Organization & Retired Fields

**Date:** 2025-07-25
**Author:** Theren
**Status:** ✅ Accepted

**Decision:** Extended the `Leader` interface with two new optional-style fields: `organization` (string|null) for institutional affiliation, and `retired` (boolean) for tracking active vs retired leaders. All existing leaders default to `organization: null, retired: false`. Wayne Savage is the first entry with both populated.

**Rationale:** The group has historical founders who are no longer active organizers. The `retired` field enables future UI differentiation (e.g., faded cards, separate section). The `organization` field supports attribution to institutions like NMSU Arrowhead Research Park. Both fields are additive — existing rendering code ignores them, so no breaking changes.

**Impact:** `src/data/leaders.json`, `src/components/footer/leader-card.tsx` (type only), all test fixtures.

---

## DEC-005: Footer Restyle — Design Token Integration

**Date:** 2025-07-25
**Author:** Lyren
**Status:** ✅ Accepted

**Decision:** Complete footer restyle to integrate with the Cloud Del Norte design token system. Key design choices:

1. **Gradient accent top-border** via `::after` pseudo-element (not `::before`, which cards use)
2. **Social links as accessible pills** — 44px min touch targets, `[role="listitem"]` styled containers wrapping Cloudscape Link components
3. **Retired cards** — `filter: saturate(0.72)` muted look with amber→gold `::before` accent line
4. **Community text** — `<p>` with `max-width: 800px` and `font-size: var(--cdn-text-lg)` replacing `Box variant="small"`
5. **"Go Build" gradient text** — amber→orange (light), violet→cyan (dark) via `background-clip: text`
6. **Heading underline** — centered gradient underline instead of left-border (better for centered footer)
7. **Grid** — 3 columns at ≥1200px (2 rows of 3 for 6 cards)
8. **Stagger animation** — nth-child(5)(6) added to tokens.css for reusability

**Rationale:** The first-pass footer used generic colors and minimal token integration. This restyle makes the footer feel like an organic part of the warm-sepia (light) / cosmic-navy (dark) brand language, matching the top-nav and card patterns established in tokens.css and shell/styles.css.

**Affected files:**
- `src/components/footer/styles.css` — complete rewrite
- `src/components/footer/leader-card.tsx` — org display class change
- `src/styles/tokens.css` — nth-child(5)(6) stagger delays

---

## DEC-006: Footer Test Update for Leader Data Structure Changes

**Date:** 2025-07-25
**Author:** Kess
**Status:** ✅ Accepted

**Decision:** Updated Badge mock in leader-card tests to expose `color` prop via `data-color` attribute. Added 6 new tests covering: organization display, retired CSS class, badge color variants (grey for retired, green for active), community description text, and Global AWS UG Community link. Updated LeaderCard source to support `cdn-footer-retired` class, organization display, and retired badge color logic.

**Rationale:** Lyren and Theren updated the footer data model (6 leaders, organization/retired fields, community description replacing copyright). Tests needed to match the new contract. The Badge mock lacked color prop forwarding, making badge color testing impossible — fixed by adding `data-color` attribute. Source component changes (retired class, organization rendering, badge color) were required to make tests pass since they implement the new data contract.

**Test result:** 99/99 passing

