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
    mem_limit: 4294967296 # 4 GB hard ceiling
    memswap_limit: 4294967296 # no swap — fail fast
  capture-prod:
    mem_limit: 4294967296
    memswap_limit: 4294967296
```

Setting `memswap_limit` equal to `mem_limit` means the container can't swap-thrash its way to a slow death. It hits the wall and dies. That's what you want — bounded failure is recoverable, global OOM is not.

## rules for browser steps in CI

1. Always set `mem_limit` on any step running headless Chrome or Playwright
2. Set `memswap_limit` equal to `mem_limit` — crash over thrash
3. Prefer container death over host freeze
