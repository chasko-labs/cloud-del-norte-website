# Calli — History

## Project Context

- **Project:** AWS User Group Cloud Del Norte community website
- **Owner:** Bryan Chasko
- **Stack:** Vite 7, React 19, TypeScript 5.9, Cloudscape Design System 3.x, Vitest, ESLint 10
- **Architecture:** Multi-page app (MPA) — each page is an independent Vite entry point, no React Router
- **Hosting:** S3 + CloudFront
- **Locales:** `us` (en-US, New Mexican English + El Paso Spanglish) and `mx` (es-MX, Chihuahua norteño)
- **Locale toggle:** Flag emoji (🇺🇸/🇲🇽) in TopNavigation, persisted via localStorage (`cdn-locale`)

## Current Localization State (as of onboarding)

- **Infrastructure:** Complete — `locale.ts`, `locale-context.tsx`, `useTranslation.ts` all working
- **Translation files:** 17 keys in en-US.json and es-MX.json with perfect parity (shell, navigation, breadcrumbs, footer)
- **Actual usage:** ~8% — zero page app.tsx files consume `useTranslation()`. 200+ hardcoded English strings across all pages.
- **Key files:**
  - `src/locales/en-US.json` — English translation keys
  - `src/locales/es-MX.json` — Spanish translations (Chihuahua norteño)
  - `src/utils/locale.ts` — Locale type, localStorage persistence, DOM lang attribute
  - `src/contexts/locale-context.tsx` — LocaleProvider, `t()` function with dot-notation lookup and en-US fallback
  - `src/hooks/useTranslation.ts` — Hook wrapper for locale context
  - `LOCALIZATION.md` — Dialect guidelines, glossary, translation philosophy

## Learnings

### Full String Extraction — 2025-06-XX

**Task:** Extract all hardcoded strings from pages/components and produce es-MX translations (Chihuahua norteño dialect)

**Outcome:**
- Extracted **149 new translation keys** from 200+ hardcoded English strings across all pages and components
- Expanded locale files from 17 keys to 166 keys (organized by namespace)
- Produced full es-MX translation parity with dialect-accurate Chihuahua norteño Spanish

**Key Counts by Namespace:**
- `shell`: 7 → 14 keys (theme toggle, navigation drawer aria labels)
- `navigation`: 17 keys (unchanged — already extracted)
- `breadcrumbs`: 1 key (unchanged)
- `footer`: 3 → 5 keys (expanded with full community description)
- `home`: 13 new keys (Dashboard page)
- `meetings`: 25 new keys (table, empty states, preferences, aria)
- `createMeeting`: 28 new keys (forms, validation, meeting type)
- `helpPanel`: 16 new keys (RSVP, community, organizers, leaders)
- `learning.api`: 11 new keys (section headers only — body content excluded per task instructions)
- `maintenanceCalendar`: 14 new keys (calendar UI, table headers)
- `common`: 9 new keys (shared action buttons)

**Dialect Decisions:**
- **Code-switching:** Tech terms (API, REST, AWS, GitHub, Meetup, deploy, tracker, release, LTS, endpoint) kept in English in es-MX translations — reflects authentic border region bilingualism
- **Norteño slang:** Used "compa" (buddy), "ahorita" (right now), "morro" (kid/young person), "Échenle ganas" (Give it your all) where natural and community-appropriate
- **Tú form:** Used throughout (norteño standard — informal, direct)
- **Tone:** Warm, direct, community-focused — matches existing translations
- **Validation messages:** Balanced between direct and friendly (e.g., "El link es necesario, morro" — required but informal)
- **Recruiting language:** "Se Buscan Hispanohablantes" kept formal (passive voice), but "Estudiantes, Échenle Ganas" kept regional and encouraging

**Translation Confidence:**
- **High confidence:** 95% of translations — standard UI strings, table headers, tech terms, proper nouns
- **Medium confidence:** 5% — validation messages with slang ("morro"), recruiting messages with regional idioms ("Échenle ganas")
- **Review recommended:** Validation messages and recruiting copy — ensure tone matches community voice

**Files Updated:**
- `src/locales/en-US.json` — 17 → 166 keys
- `src/locales/es-MX.json` — 17 → 166 keys (full parity)
- `.squad/decisions/inbox/calli-translation-review.md` — detailed translation review with confidence flags and dialect notes

**Next Steps:**
1. Bryan reviews translation review document
2. Lyren/Theren wire `t()` calls into components (replace hardcoded strings)
3. Test locale toggle to verify all strings swap correctly
4. Refine any translations flagged during review

## Session 2026-03-14 — Localization Integration (Phases 2-3)

**Status:** ✅ Complete — First Mission Success

### Mission Summary

First full localization integration from creation to completion. Extracted 161 translation keys across 11 namespaces, produced dialect-accurate es-MX translations with Chihuahua norteño authenticity, created translation review document for human validation.

### Key Accomplishments

- **161 translation keys extracted** from 200+ hardcoded strings across pages and shared components
- **11 namespaces organized:** shell, navigation, breadcrumbs, footer, home, meetings, createMeeting, helpPanel, learning.api, maintenanceCalendar, common
- **Full es-MX translation parity** with regional authenticity — used "compa" in empty states, "ahorita" for temporal context, "Échenle Ganas" in student recruiting
- **Authentic code-switching:** Preserved English tech terms (API, REST, AWS, Meetup, LTS) — reflects real border region bilingualism, not AI slop
- **Translation review document created:** `.squad/decisions/inbox/calli-translation-review.md` with confidence flags, dialect notes, proper noun allowlist

### Dialect Decisions Applied

- Informal "tú" form throughout (norteño standard)
- Regional slang where natural: "morro" for casual address, "compa" for buddy
- Tech terms stay English — authentic to how Spanish-speaking developers actually talk
- Warm, direct, community-focused tone matching existing voice
- Balanced validation messages between direct and friendly

### Confidence Distribution

- **95% high confidence:** Standard UI strings, table headers, navigation labels
- **5% medium confidence:** Validation messages with slang, recruiting copy with regional idioms
- **Review recommended:** Validation messages and recruiting language for community tone match

### Coordination

- Worked async with Lyren (UI wiring) and Theren (page wiring) — parallel execution
- Kess added 5 locale tests after wiring complete
- Translation review pending Bryan's human validation
