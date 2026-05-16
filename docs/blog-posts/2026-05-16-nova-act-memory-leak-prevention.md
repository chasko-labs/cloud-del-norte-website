[//]: # "TODO: add to blog feed once /blog route exists"

# nova act memory leak prevention

**2026-05-16**

Playwright Chromium in our Woodpecker CI containers had no memory ceiling. During screenshot capture, Chrome grew unbounded, triggered a global OOM on rocm-aibox, and froze the host. Hard reset required.

The numbers look scary if you don't read them right: Chrome reported 11.7GB virtual address space. Actual RSS was 125MB. Virtual address space is memory _mapped_, not memory _used_ — Chrome pre-maps large regions it may never touch. The real problem wasn't 11.7GB of consumption. It was zero bounds on a process that _can_ grow without limit given enough tabs and time.

## root cause

`.woodpecker/screenshot.yml` steps `capture-dev` and `capture-prod` ran with `mem_limit: 0`. No ceiling. Chromium grew until the kernel OOM killer couldn't recover gracefully.

## the fix

```yaml
# .woodpecker/screenshot.yml
steps:
  capture-dev:
    image: mcr.microsoft.com/playwright:v1.60.0-noble
    init: true
    mem_limit: 4294967296 # 4 GB hard ceiling
    memswap_limit: 4294967296 # no swap — fail fast
  capture-prod:
    image: mcr.microsoft.com/playwright:v1.60.0-noble
    init: true
    mem_limit: 4294967296
    memswap_limit: 4294967296
```

Setting `memswap_limit` equal to `mem_limit` means the container can't swap-thrash its way to a slow death. It hits the wall and dies. That's what you want — bounded failure is recoverable, global OOM is not.

## version pins and zombie reaping

- **Playwright image pinned to v1.60.0-noble** (was v1.49.0-jammy — 11 versions behind). Pinning prevents silent breakage from upstream changes.
- **Puppeteer image pinned to v25.0.1** (was `:latest` — unpinned). Same rationale.
- **Nova Act SDK bumped from v0.1.0 to v3.1** (was 3 major versions behind). Older SDK had known resource cleanup bugs.
- **`init: true` added to all pipeline steps** — runs a tiny init process (tini) as PID 1 that reaps zombie Chrome child processes. Playwright Docker docs recommend `--init` to avoid PID=1 zombie accumulation. Without it, defunct renderer processes pile up and consume PIDs/memory.
- **`--disable-features=HttpsFirstBalancedModeAutoEnable`** added for HTTP test targets. Chrome 128+ blocks HTTP navigation by default; this flag restores access to HTTP-only staging environments.

## host-level hardening

- **MCP servers scoped to on-demand loading** — jupyter, chrome-devtools, goose-docs removed from the default set. Saves ~9 GB RAM per session by not pre-loading unused language servers.
- **Woodpecker agent global limits** — 6 GB mem, 4-core CPU, 256 MB shm enforced on every pipeline container regardless of what `.woodpecker.yml` declares. This is the backstop; per-step `mem_limit` is the fine-grained control.
- **Systemd MemoryHigh + MemoryMax** on all inference and MCP services. If a model server or MCP process leaks, systemd throttles it (MemoryHigh) then kills it (MemoryMax) before it can OOM the host.

## rules for browser steps in CI

1. Always set `mem_limit` on any step running headless Chrome or Playwright
2. Set `memswap_limit` equal to `mem_limit` — crash over thrash
3. Prefer container death over host freeze
4. Always use `init: true` — reap zombie renderers
5. Pin image versions — never use `:latest` for browser images
6. Add `--disable-features=HttpsFirstBalancedModeAutoEnable` when testing HTTP targets

## pipeline hardening summary

| Layer                   | Control         | Value                                                 |
| ----------------------- | --------------- | ----------------------------------------------------- |
| Woodpecker agent global | mem limit       | 6 GB                                                  |
| Woodpecker agent global | CPU             | 4 cores                                               |
| Woodpecker agent global | shm             | 256 MB                                                |
| Per-step                | `mem_limit`     | 4 GB                                                  |
| Per-step                | `memswap_limit` | 4 GB (no swap)                                        |
| Per-step                | `init`          | `true` (zombie reaping)                               |
| Playwright image        | version pin     | v1.60.0-noble                                         |
| Puppeteer image         | version pin     | v25.0.1                                               |
| Nova Act SDK            | version pin     | v3.1                                                  |
| Chrome flags            | HTTP targets    | `--disable-features=HttpsFirstBalancedModeAutoEnable` |
| Systemd                 | inference/MCP   | MemoryHigh + MemoryMax                                |
