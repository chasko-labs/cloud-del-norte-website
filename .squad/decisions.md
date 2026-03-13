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
