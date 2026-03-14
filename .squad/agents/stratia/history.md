# Agent History

**Created:** 2026-03-13
**Agent:** Stratia (Strategy & Architecture Advisor)

## Core Context

Initial setup — Squad team infrastructure created for Cloudscape Design System website project.

## Learnings

### 2026-03-14 — Localization Architecture Validation

- **MPA constraint honored:** LocaleProvider-per-page pattern (each page creates its own provider) respects MPA architecture — no shared runtime between pages
- **Zero-dependency i18n:** Custom lightweight translation system with dot-notation lookup and en-US fallback — no need for react-intl, i18next, or similar
- **Build impact:** None — translation JSON files statically imported and tree-shaken per page by Vite. Locale utility bundle (~3.4KB gzip) shared across pages via chunking.
- **Architecture decision validated:** The ShellContent extraction pattern (component rendering provider cannot consume that provider — must extract child) is architecturally sound and reusable for any provider/consumer pattern

### 2025-07-18 — Localization Pipeline Strategy (Phase 5)

- **3-phase pipeline designed:** Phase A (current manual workflow) → Phase B (MCP dialect lookup + Qdrant embeddings) → Phase C (automated LLM dialect review in CI/CD)
- **Two custom MCP tools proposed:** `localization-mcp-dialect-lookup` (public corpus queries) and `localization-mcp-glossary` (curated border-region Spanglish/Chicano English terms)
- **Public corpora catalogued:** Corpus del Español, COCA, OPUS (OpenSubtitles + ParaCrawl), UD Treebanks, Wiktionary (Spanglish + Chicano English categories), UTEP Bilingualism Institute, INEGI linguistic surveys
- **Phase B trigger:** key count exceeds ~300 or third locale considered
- **Phase C trigger:** Phase B tools stable + community feedback loop operational
- **Integration strategy:** New MCP tools complement existing `context7` (Cloudscape label validation) and `fetch` (live corpus queries) — no architectural disruption
- **Deliverables:** LOCALIZATION.md §§9–10 (pipeline phases + timeline), `.squad/skills/mcp-dialect-lookup/SKILL.md`, `.squad/decisions/inbox/stratia-localization-strategy.md`
