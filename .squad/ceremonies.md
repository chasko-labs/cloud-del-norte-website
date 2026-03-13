# Ceremonies

> Team meetings that happen before or after work.

## Design Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | multi-agent task involving 2+ agents modifying shared systems (Shell, navigation, theme) |
| **Facilitator** | lead |
| **Participants** | all-relevant |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Review the task and requirements
2. Agree on Cloudscape component choices and patterns
3. Identify risks (breaking existing pages, theme regressions, navigation conflicts)
4. Assign action items

---

## Retrospective

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | after |
| **Condition** | build failure, test failure, deploy issue, or reviewer rejection |
| **Facilitator** | lead |
| **Participants** | all-involved |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. What happened? (facts only)
2. Root cause analysis
3. What should change?
4. Action items with owners

---

## New Page Review

| Field | Value |
|-------|-------|
| **Trigger** | auto |
| **When** | before |
| **Condition** | adding a new page to the MPA (new entry in vite.config.ts) |
| **Facilitator** | Vael |
| **Participants** | Vael + Lyren + Theren |
| **Time budget** | focused |
| **Enabled** | ✅ yes |

**Agenda:**
1. Confirm page anatomy (index.html, main.tsx, app.tsx) follows conventions
2. Confirm vite.config.ts entry is correct
3. Confirm navigation item added in shared navigation component
4. Confirm breadcrumb configuration
5. Identify which Cloudscape components the page needs
6. Confirm test plan exists (Kess consulted if needed)
