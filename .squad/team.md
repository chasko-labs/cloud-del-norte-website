# Team Roster

> AWS User Group Cloud Del Norte community website. Cloudscape Design System MPA deployed to S3 + CloudFront. Meeting announcements, resources, and learning content.

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Harald | Lead (Coordinator) | Routes work, decomposes tasks, manages priority and scope. Does not generate domain artifacts — delegates implementation to specialists. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Stratia | Strategy & Architecture Advisor | `.squad/agents/stratia/charter.md` | ✅ Active |
| Lyren | Cloudscape UI & Design Specialist | `.squad/agents/lyren/charter.md` | ✅ Active |
| Vael | MPA Build & Deploy Engineer | `.squad/agents/vael/charter.md` | ✅ Active |
| Theren | Content & Data Specialist | `.squad/agents/theren/charter.md` | ✅ Active |
| Kess | Testing Lead | `.squad/agents/kess/charter.md` | ✅ Active |
| Scribe | Session Logger | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Work Monitor | — | 🔄 Monitor |

## Coding Agent

<!-- copilot-auto-assign: false -->

| Name | Role | Charter | Status |
|------|------|---------|--------|
| @copilot | Coding Agent | — | 🤖 Coding Agent |

### Capabilities

**🟢 Good fit — auto-route when enabled:**
- Bug fixes with clear reproduction steps
- Adding new Cloudscape components following existing patterns
- Test coverage (adding missing tests, fixing flaky tests)
- Lint/format fixes and code style cleanup
- Dependency updates and version bumps
- New page scaffolding following MPA page anatomy
- Documentation fixes and README updates
- Navigation item additions

**🟡 Needs review — route to @copilot but flag for squad member PR review:**
- New pages with complex Cloudscape component composition
- Theme/design token changes
- Build configuration changes (vite.config.ts)
- Data pipeline additions (new fetch scripts, JSON data files)

**🔴 Not suitable — route to squad member instead:**
- Architecture decisions (MPA constraints, new component library proposals) (→ Stratia)
- Complex Cloudscape layout patterns (AppLayout changes, shell modifications) (→ Lyren)
- Build pipeline restructuring (→ Vael)
- Deploy infrastructure changes (S3/CloudFront config) (→ Vael)
- Cross-cutting test strategy (→ Kess)

## Project Context

- **Owner:** Bryan Chasko
- **Stack:** Vite 7, React 19, TypeScript 5.9, Cloudscape Design System 3.x, Vitest, ESLint 10
- **Description:** Community website for the AWS User Group Cloud Del Norte. Multi-page app with meeting announcements, resources, and learning content. Deployed to S3 + CloudFront.
- **Persona Source:** [HeraldStack](https://github.com/BryanChasko/HeraldStack) — Bryan's ambient intelligence system. Personas are drawn from HeraldStack entities; technical concepts are project-specific.
- **Created:** 2026-03-13
