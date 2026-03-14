# Localization

> Cloud Del Norte — US/MX locale system

---

## 1. Localization System Overview

The site supports two locales via a flag emoji toggle, mirroring the existing light/dark theme toggle:

- **🇺🇸 US** — English (New Mexican English with Spanglish)
- **🇲🇽 MX** — Spanish (Chihuahua norteño dialect)

### How it works

| Concept | Detail |
| ------- | ------ |
| Toggle | Flag emoji (🇺🇸 / 🇲🇽) next to the moon/sun theme toggle |
| File structure | `src/locales/en-US.json` and `src/locales/es-MX.json` |
| Library | Custom lightweight i18n — zero library dependencies |
| Hook | `useTranslation()` provides `t('key.path')` for dot-notation string lookup |
| Persistence | `src/utils/locale.ts` stores the active locale in `localStorage` (key: `cdn-locale`) |
| Accessibility | `applyLocale()` sets `document.documentElement.lang` (`en-US` or `es-MX`) |

---

## 2. Regional Dialects — The Border Region

This is one of the most linguistically unique regions in North America. The El Paso / Ciudad Juárez / Las Cruces metro area sits at the intersection of three US states, one Mexican state, and multiple living dialects. The localization voice for this project draws directly from this reality.

### El Paso, TX — Border Spanglish / Chicano English

- Heavy code-switching between English and Spanish within a single sentence ("Let's irnos", "I'll pick you up ahorita")
- English syntax with Spanish insertions — Spanish words fill English grammatical slots
- Spanish phonology influencing English pronunciation ("eskoo" for "school")
- Borrowed Caló terms integrated into everyday speech ("orale", "vato", "firme")
- Bilingual fluency is the norm, not the exception

### Ciudad Juárez, MX — Northern Mexican Spanish

- Fast, clipped delivery — distinct from the slower cadence of central Mexico
- Distinct regional slang: "que rollo", "morro", "parqueadero", "chido", "fierro"
- Strong influence from US English loanwords, especially in tech and commerce
- Frequent diminutives ("ahorita", "ratito", "poquito")
- "Tú" dominant; "usted" used but less formal than in central Mexico
- Direct, informal tone — norteño culture values straightforwardness

### Las Cruces, NM — New Mexico English + Heritage Spanish

- Mostly standard American English with Southwestern vocabulary
- Heritage Spanish influence on everyday English: "lonche" (lunch), "parquear" (park), "troque" (truck)
- Some New Mexican Spanish archaisms survive in older families (e.g., "ansina" for "así", "muncho" for "mucho")
- Less Spanglish than El Paso but still present in casual speech
- Strong identity connection to both English and Spanish linguistic heritage

---

## 3. Open Resources for Dialect Research

### Spanglish / Chicano English

- **UTEP Bilingualism Institute / Border Corpora** — University of Texas at El Paso research on bilingual speech patterns
- **UCLA Chicano English studies** — open PDFs on phonology, syntax, and sociolinguistics
- **Wiktionary: Chicano English & Spanglish entries** — community-maintained lexicon
- **OpenSubtitles** — bilingual, informal speech corpus searchable by language pair
- **Corpus of Contemporary American English (COCA)** — regional tags for Southwestern English

### Northern Mexican Spanish (Juárez)

- **UNAM dialect corpora** — open-access linguistic data from the National Autonomous University of Mexico
- **INEGI linguistic surveys / datasets** — Mexican census and language data
- **"El Habla de Chihuahua"** — open academic PDFs on Chihuahua state speech patterns
- **Wiktionary: Mexican Spanish** — regional vocabulary entries
- **Northern Mexican Spanish corpora** — public university archives from border-region universities

### NM English / Heritage Spanish

- **NMSU bilingual studies** — New Mexico State University research on border bilingualism
- **NM Digital Heritage archives** — digitized oral histories and linguistic records
- **Linguistic Atlas of the Southwest** — open-access dialect mapping
- **"New Mexican Spanish"** — open academic papers on archaic and heritage forms

---

## 4. Translation Guidelines for Contributors

This is **cultural flavor localization**, not mechanical translation. The goal is to sound like a real person from the border region, not a corporate website run through Google Translate.

### en-US voice

New Mexican English with Spanglish where natural — community tone, not corporate. Code-switching is intentional.

| Do | Don't |
| -- | ----- |
| "Nada on the calendar, compa" | "Nothing to display" |
| "Check out the latest meetup, orale" | "Please review the upcoming event" |
| "We're deploying ahorita" | "Deployment is in progress" |

### es-MX voice

Chihuahua norteño dialect — informal "tú" form, direct tone, regional slang.

| Do | Don't |
| -- | ----- |
| "Checa el API, fierro" | "Por favor revise la interfaz de programación" |
| "No hay juntas ahorita, morro" | "No hay reuniones programadas en este momento" |
| "Ya se subió el deploy" | "El despliegue ha sido completado exitosamente" |

### General rules

- **Code-switching is intentional, not an error.** Both locale files may contain words from the other language where it sounds natural.
- **Tech terms stay in English** in both locales: API, deploy, dashboard, GitHub, AWS, CloudFront.
- **Proper nouns stay unchanged:** Cloud Del Norte, AWS, GitHub, Vite, Cloudscape.
- **Keep it casual.** These are community meetup pages, not enterprise documentation.

### Regional Glossary

| Term | Language | Meaning / Usage |
| ---- | -------- | --------------- |
| ahorita | ES (MX) | "Right now" or "in a little bit" — context-dependent; ubiquitous in border speech |
| orale | ES (Caló) | "Right on", "let's go", general affirmation — common in Chicano English too |
| compa | ES (MX) | Short for "compadre" — buddy, friend; casual address |
| fierro | ES (Norte) | "Iron" literally — slang for "hell yeah", "let's do it"; Chihuahua/Juárez regional |
| morro / morra | ES (MX) | Kid, young person; informal, common in northern Mexico |
| lonche | Spanglish | "Lunch" — English loan integrated into border Spanish |
| troque | Spanglish | "Truck" — English loan with Spanish phonology |
| parquear | Spanglish | "To park" — English verb with Spanish conjugation |
| chido | ES (MX) | "Cool", "nice" — Mexican slang, widely used |
| que rollo | ES (MX) | "What's up" — informal greeting, northern Mexico |
| vato | ES (Caló) | "Dude", "guy" — Caló origin, common in Chicano English |
| firme | ES (Caló) | "Cool", "solid", "right on" — Caló origin |

---

## 5. MCP Servers for Localization Workflows

These MCP servers can assist with translation, dialect consistency, and bilingual content workflows:

| Server | What It Adds | Use Case |
| ------ | ------------ | -------- |
| Qdrant MCP (`qdrant/mcp-server-qdrant`) | Cross-lingual semantic search, dialect retrieval, tone memory | Find similar phrases, cluster Spanglish patterns, maintain translation consistency |
| LanguageTool MCP (community) | Grammar/style checking for EN + ES | Accent marks, gender agreement, verb conjugation, code-switch error detection |
| LibreTranslate MCP (community) | Local open-source translation engine | Terminology-controlled pipelines, enforce border-region vocabulary |
| TranscriptionTools-MCP (`MushroomFleet/TranscriptionTools-MCP`) | Bilingual speech to structured text | Build realistic corpora from border-region speech with code-switch detection |
| Memory MCP (`modelcontextprotocol/servers`) | Persistent dialect/tone rules | Store per-locale voice rules ("Juárez = informal, tú, slang allowed") |
