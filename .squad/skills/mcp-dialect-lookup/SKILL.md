# Skill: MCP Dialect Lookup & Glossary

**Confidence:** low (not yet implemented)
**Domain:** localization, tooling
**Applies to:** Calli (primary), Sophia, Sofía, Stratia
**Last updated:** 2025-07-18

## Summary

Proposed MCP server tools for querying public linguistic corpora and a curated
border-region glossary during translation workflows. Part of the Phase B
localization pipeline (see `LOCALIZATION.md` §9).

## Proposed MCP Tools

### `localization-mcp-dialect-lookup`

Queries public linguistic corpora for dialect verification and term frequency.

**Interface:**

```typescript
// Look up a term in regional context
dialect_term(params: {
  term: string;          // e.g., "ahorita"
  region: string;        // e.g., "chihuahua", "el-paso", "border"
  lang: "en" | "es";     // target language
}) → {
  definition: string;
  examples: string[];        // usage examples from corpora
  confidence: "high" | "medium" | "low";
  sources: string[];         // corpus citations
  register: "formal" | "informal" | "slang";
}

// Get frequency data from a specific corpus
dialect_frequency(params: {
  term: string;
  corpus: "corpus-del-espanol" | "coca" | "opus-opensubtitles" | "wiktionary";
}) → {
  frequency: number;         // occurrences per million words
  register: string;          // formal/informal/slang
  regional_rank: number;     // rank within region vs national
  comparison: { national: number; regional: number };
}

// Get regional alternatives for a term
dialect_alternatives(params: {
  term: string;
  region: string;
}) → {
  alternatives: Array<{
    term: string;
    usage_frequency: number;
    register: string;
    notes: string;
  }>;
}
```

**Data sources:**

| Corpus | Access Method | Notes |
|--------|--------------|-------|
| Corpus del Español | Web scrape / API | 2B words, dialect-tagged |
| COCA | Web scrape / API | 1B words, US English |
| OPUS OpenSubtitles | Download / API | Conversational EN↔ES pairs |
| UD Treebanks | Download | Syntactic annotations (MX Spanish) |
| Wiktionary | MediaWiki API | Spanglish + Chicano English categories |
| INEGI | Download / API | Linguistic demographic data |

### `localization-mcp-glossary`

Curated glossary of border-region Spanglish and Chicano English terms.

**Interface:**

```typescript
// Look up a glossary term
lookup(params: {
  term: string;
}) → {
  definition: string;
  origin: "spanish" | "english" | "calo" | "spanglish" | "nahuatl";
  regional_variants: Record<string, string>;  // region → variant form
  examples: string[];
  register: string;
  notes: string;
}

// Suggest terms for a UI context
suggest(params: {
  context: string;      // e.g., "empty state message for meetings page"
  locale: "us" | "mx";
}) → {
  suggestions: Array<{
    term: string;
    reason: string;
    example_usage: string;
  }>;
}

// Validate a translation against the glossary
validate(params: {
  key: string;          // translation key, e.g., "meetings.empty.noMatches"
  text: string;         // proposed translation text
  locale: "us" | "mx";
}) → {
  valid: boolean;
  issues: Array<{
    term: string;
    issue: "wrong_register" | "wrong_region" | "not_in_glossary" | "formality_mismatch";
    suggestion: string;
  }>;
}
```

**Glossary seed data:** ~50 terms from `LOCALIZATION.md` Regional Glossary (§7).
**Target:** ~200 terms curated from UTEP, Wiktionary, and community contributions.

## Integration with Existing MCP Tools

| Tool | Integration |
|------|-------------|
| `context7` | After glossary lookup, validate Cloudscape label conventions |
| `fetch` | Fallback for live corpus queries when MCP dialect tool unavailable |
| `github` | Create issues for flagged translations with corpus citations |

## Implementation Notes

- **MCP server runtime:** Node.js (TypeScript) — matches project stack
- **Data storage:** SQLite for glossary, JSON cache for corpus results
- **Cache TTL:** 30 days for corpus queries, glossary is always fresh
- **Auth:** None for public corpora; INEGI may require registration

## Prerequisites

1. MCP server scaffold (see `@modelcontextprotocol/sdk`)
2. Corpus access verification (some require registration)
3. Glossary curation (~200 terms minimum)
4. Integration testing with existing `context7` and `fetch` MCPs

## Agent Routing

| Agent | Role |
|-------|------|
| **Calli** | Primary consumer — uses tools during translation workflow |
| **Sophia** | Queries en-US dialect data, Chicano English terms |
| **Sofía** | Queries es-MX dialect data, norteño terms |
| **Stratia** | Architecture owner — tool design and integration |
| **Vael** | MCP server deployment and configuration |
