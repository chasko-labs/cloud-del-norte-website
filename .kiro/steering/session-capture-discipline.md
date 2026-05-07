# Session Capture Discipline

At session end, store a structured capture to `qdrant-agent-memory`.

## Metadata

```
project: cloud-del-norte-website
type: session-end-capture
session_date: YYYY-MM-DD
agent: poltergeist-harald-core-anchor
```

## Required Fields

| Field | Required |
|-------|----------|
| commits_pushed | always |
| current_branch | full |
| dispatches | full |
| issues_filed | full |
| blockers_remaining | always |
| performance_notes | full |
| next_priorities | always |

Minimum viable (low context budget): `commits_pushed` + `blockers_remaining` + `next_priorities`.

## Retrieval

```
qdrant-find 'cloud-del-norte-website session-end-capture'
```

## Status

Interim manual discipline. Automated hooks planned via `haunting-kiro-cli` — see filed issue in that repo once created. This doc becomes redundant when hooks land.
