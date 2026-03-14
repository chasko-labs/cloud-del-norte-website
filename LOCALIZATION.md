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
| Toggle | Flag emoji (🇺🇸 / 🇲🇽) next to the moon/sun theme toggle in TopNavigation |
| File structure | `src/locales/en-US.json` and `src/locales/es-MX.json` (161 keys each) |
| Library | Custom lightweight i18n — zero library dependencies |
| Hook | `useTranslation()` provides `t('key.path')` for dot-notation string lookup |
| Context | `LocaleProvider` wraps page content via Shell component |
| State management | Each page's `app.tsx` maintains locale state (mirrors theme pattern) |
| Persistence | `src/utils/locale.ts` stores the active locale in `localStorage` (key: `cdn-locale`) |
| Accessibility | `applyLocale()` sets `document.documentElement.lang` (`en-US` or `es-MX`) |

#### Implementation Flow

1. User clicks 🇺🇸↔🇲🇽 toggle in TopNavigation
2. `app.tsx` calls `handleLocaleChange(newLocale)`
3. Updates React state → triggers re-render
4. Writes to localStorage (`cdn-locale`)
5. `applyLocale()` updates `document.documentElement.lang`
6. All `t('key')` calls resolve to new locale strings

---

## 2. Translation Key Structure

The project uses a **namespace-based hierarchy** with 161 keys across 7 namespaces:

### Namespaces

| Namespace | Keys | Purpose |
| --------- | ---- | ------- |
| `shell.*` | Shell layout (title, description, theme labels) |
| `navigation.*` | Navigation items (Home, Meetings, Learning, Maintenance Calendar) |
| `breadcrumbs.*` | Breadcrumb labels (Home, Create Meeting, API, etc.) |
| `footer.*` | Footer content (leader cards, description) |
| `home.*` | Home page content |
| `meetings.*` | Meetings page (table headers, empty state) |
| `createMeeting.*` | Create Meeting form (field labels, buttons) |
| `helpPanel.*` | Help panel content |
| `learning.api.*` | API Learning page content |
| `maintenanceCalendar.*` | Maintenance Calendar page (table, empty state) |
| `common.*` | Shared strings (buttons, states) |

### Key Naming Convention

- **camelCase** for multi-word keys: `noMeetings`, `createMeeting`, `emptyState`
- **Dot-notation hierarchy** for namespacing: `meetings.table.headers.date`
- **Descriptive names** over abbreviations: `meetingDescription` not `meetingDesc`

### Example Key Structure

```json
{
  "meetings": {
    "title": "Upcoming Meetings",
    "table": {
      "headers": {
        "date": "Date",
        "title": "Title",
        "location": "Location"
      }
    },
    "emptyState": {
      "title": "No meetings scheduled",
      "description": "Check back soon for upcoming events"
    }
  }
}
```

---

## 3. Adding New Translations

### Workflow for Contributors

1. **Add key to BOTH locale files** — `src/locales/en-US.json` AND `src/locales/es-MX.json`
   - Keys must match exactly across files (test enforces parity)
   - Use namespace hierarchy: `"namespace.keyName": "value"`

2. **Use `t()` in component JSX:**
   ```tsx
   import { useTranslation } from '../../hooks/useTranslation';

   export default function MyComponent() {
     const { t } = useTranslation();
     return <h1>{t('myNamespace.title')}</h1>;
   }
   ```

3. **Run tests to verify key parity:**
   ```bash
   npm test  # fails if keys don't match between en-US.json and es-MX.json
   ```

### Example: Adding a New Feature

Let's add a "Contact Us" page:

**Step 1:** Add keys to both locale files

```json
// src/locales/en-US.json
{
  "contact": {
    "title": "Get in touch, orale",
    "description": "Drop us a message ahorita",
    "form": {
      "name": "Your name",
      "email": "Email",
      "message": "Message",
      "submit": "Send it"
    }
  }
}

// src/locales/es-MX.json
{
  "contact": {
    "title": "Contáctanos, fierro",
    "description": "Mándanos mensaje ahorita",
    "form": {
      "name": "Tu nombre",
      "email": "Correo",
      "message": "Mensaje",
      "submit": "Enviar"
    }
  }
}
```

**Step 2:** Use in component

```tsx
export default function ContactPage() {
  const { t } = useTranslation();
  return (
    <div>
      <h1>{t('contact.title')}</h1>
      <p>{t('contact.description')}</p>
      <form>
        <input placeholder={t('contact.form.name')} />
        <input placeholder={t('contact.form.email')} />
        <textarea placeholder={t('contact.form.message')} />
        <button>{t('contact.form.submit')}</button>
      </form>
    </div>
  );
}
```

**Step 3:** Test

```bash
npm test  # verifies key parity + renders without errors
```

---

## 4. MCP Translation Workflow

For agents and contributors using MCPs to generate or refine translations:

### Process

1. **Research dialect** — use `fetch` MCP for open resources:
   - Wiktionary (Chicano English, Mexican Spanish entries)
   - UTEP Bilingualism Institute corpora
   - UNAM dialect studies

2. **Check component conventions** — use `context7` MCP:
   - Cloudscape Design System label patterns
   - Common button/form/table text conventions

3. **Generate translations** — produce both en-US and es-MX strings

4. **Write review document** — save to `.squad/decisions/inbox/calli-<slug>.md`:
   ```markdown
   # Translation Review: <Feature Name>
   
   ## Keys Added
   - `namespace.key1`
   - `namespace.key2`
   
   ## en-US Translations
   - Key: "English text with Spanglish"
   
   ## es-MX Translations
   - Key: "Spanish text con slang norteño"
   
   ## Dialect Notes
   - Used "fierro" (Juárez slang) for affirmation
   - Code-switched "deploy" (tech term stays English)
   ```

5. **Human review required** — do NOT auto-merge translations into locale JSON files
   - Maintainer reviews dialect accuracy, tone, code-switching
   - Maintainer applies approved keys to both locale files
   - Run `npm test` to verify parity

### Key Rules for MCP Workflows

- **Never directly edit** `en-US.json` or `es-MX.json` via MCP
- **Always produce review docs** in `.squad/decisions/inbox/`
- **Flag ambiguous terms** for human review
- **Cite dialect sources** when using regional slang

---

## 5. Regional Dialects — The Border Region

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

## 6. Open Resources for Dialect Research

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

## 7. Translation Guidelines for Contributors

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

## 8. MCP Servers for Localization Workflows

These MCP servers can assist with translation, dialect consistency, and bilingual content workflows:

| Server | What It Adds | Use Case |
| ------ | ------------ | -------- |
| Qdrant MCP (`qdrant/mcp-server-qdrant`) | Cross-lingual semantic search, dialect retrieval, tone memory | Find similar phrases, cluster Spanglish patterns, maintain translation consistency |
| LanguageTool MCP (community) | Grammar/style checking for EN + ES | Accent marks, gender agreement, verb conjugation, code-switch error detection |
| LibreTranslate MCP (community) | Local open-source translation engine | Terminology-controlled pipelines, enforce border-region vocabulary |
| TranscriptionTools-MCP (`MushroomFleet/TranscriptionTools-MCP`) | Bilingual speech to structured text | Build realistic corpora from border-region speech with code-switch detection |
| Memory MCP (`modelcontextprotocol/servers`) | Persistent dialect/tone rules | Store per-locale voice rules ("Juárez = informal, tú, slang allowed") |
