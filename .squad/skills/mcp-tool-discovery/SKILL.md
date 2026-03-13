# Skill: MCP Tool Discovery & Usage

**Confidence:** medium
**Domain:** tooling
**Applies to:** all agents
**Last updated:** 2026-03-13

## Pattern

When a task requires current documentation for Cloudscape components, React APIs, or Vite configuration, prefer MCP tools over training-data recall. Cloudscape Design System updates component APIs, React 19 introduced new patterns, and Vite 7 has configuration changes — always fetch before assuming. If an MCP tool is unavailable, fall back to the listed CLI equivalent without halting.

## Why MCPs Matter for This Project

Cloudscape Design System ships new components and API changes regularly. React 19 introduced concurrent features and new hooks. Vite 7 changed build defaults. Any agent relying solely on training-data recall risks recommending deprecated component props, outdated Vite config patterns, or missing React APIs. `context7` gives agents authoritative library docs; `github` gives real-time repo state; `fetch` gives live documentation pages. Use them.

## Agent-to-MCP Mapping

| Agent | Primary MCPs | Primary Use Cases |
|-------|-------------|-------------------|
| **Lyren** (Cloudscape UI) | `context7`, `fetch` | Cloudscape component APIs, design token reference, accessibility patterns |
| **Vael** (Build/Deploy) | `context7`, `fetch` | Vite configuration docs, Rollup input options, TypeScript compiler options |
| **Theren** (Content/Data) | `fetch`, `github` | Meetup.com event data, AWS docs, cloudscape.design examples, repo file contents |
| **Kess** (Testing) | `context7`, `fetch` | Vitest configuration, @testing-library/react APIs, jsdom limitations |
| **Stratia** (Architecture) | `github`, `context7` | Issue tracking, PR management, architecture pattern references |
| **Harald** (Coordinator) | `github` | Issue triage, PR management, cross-agent coordination |
| **Scribe** (Logger) | `github` | Committing .squad/ state, issue references |

## MCP Tool Reference

### `github` — GitHub Copilot MCP

GitHub API access for code search, PRs, issues, and repo operations.

- CLI fallback: `gh` (GitHub CLI — e.g., `gh issue list`, `gh pr create`)

### `context7` — Library Documentation

Authoritative docs for npm packages and frameworks.

Two-step usage — always resolve first:
```
1. context7-resolve-library-id(libraryName="@cloudscape-design/components")
2. context7-query-docs(libraryId="<result>", query="Table component columnDefinitions")
```

Do not call `context7-query-docs` without a resolved library ID.
CLI fallback: `fetch` against the library's official docs URL.

### `fetch` — Web Fetch

Fetches any URL, returns markdown or raw HTML.

```
fetch(url="https://cloudscape.design/components/table/", max_length=5000)
```

- Use for cloudscape.design component pages, Vite docs, React docs, AWS docs
- CLI fallback: `curl -s <url> | cat`

## Key URLs by Domain

### Lyren (Cloudscape UI)
| Topic | URL |
|-------|-----|
| Cloudscape components | https://cloudscape.design/components/ |
| Cloudscape patterns | https://cloudscape.design/patterns/ |
| Cloudscape design tokens | https://cloudscape.design/foundation/visual-foundation/ |
| React docs | https://react.dev/ |

### Vael (Build/Deploy)
| Topic | URL |
|-------|-----|
| Vite MPA config | https://vite.dev/guide/build.html#multi-page-app |
| Vite config reference | https://vite.dev/config/ |
| TypeScript handbook | https://www.typescriptlang.org/docs/ |
| ESLint flat config | https://eslint.org/docs/latest/use/configure/configuration-files |

### Kess (Testing)
| Topic | URL |
|-------|-----|
| Vitest docs | https://vitest.dev/ |
| Testing Library React | https://testing-library.com/docs/react-testing-library/intro |
| jsdom | https://github.com/jsdom/jsdom |

## Graceful Degradation

If an MCP tool call fails or the tool is not present in the agent's environment, fall back immediately — do not halt or retry more than once.

| MCP Tool | Fallback |
|----------|---------|
| `github` | `gh` CLI (e.g., `gh issue list`, `gh pr view <N>`) |
| `context7` | `fetch` against the library's official docs URL |
| `fetch` | `curl -s <url> \| cat` |
