# Nova Act / Playwright Memory Leak Prevention

**Date:** 2026-05-16  
**Severity:** Critical (global OOM, hard reset required)

## Incident

Playwright Chromium processes running in Woodpecker CI containers on rocm-aibox had no memory limit (`mem_limit: 0`). On 2026-05-16, Chrome grew unbounded during screenshot capture steps, triggering a global OOM that froze the entire host requiring a hard reset.

## Root Cause

`.woodpecker/screenshot.yml` pipeline steps `capture-dev` and `capture-prod` ran Nova Act / Playwright with no container memory ceiling. Chromium's memory usage grew without bound until the kernel OOM killer could not recover gracefully.

## Fix

- Added `mem_limit: 4294967296` (4 GB) to both capture steps
- Added `memswap_limit: 4294967296` (4 GB) to prevent swap-thrashing — fail fast instead

## Prevention Patterns

1. **Always set `mem_limit`** on CI steps running browsers or headless Chrome
2. **Set `memswap_limit` equal to `mem_limit`** to fail fast rather than swap-thrash
3. **Monitor container memory** in long-running browser automation tasks
4. **Prefer crash over host freeze** — bounded failure is recoverable, global OOM is not
