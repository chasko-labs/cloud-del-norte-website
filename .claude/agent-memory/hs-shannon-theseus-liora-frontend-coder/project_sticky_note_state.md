---
name: sticky note state machine v7
description: two-stage crack choreography + fly-out — CSS classes, embed ownership, React bail-out guard
type: project
---

v7 sticky note state machine (2026-04-27):

screen click 1 → bezel gets `screen-tap-1` → CSS `liora-stickynote-sway` keyframe (pendulum, no fall, 2 swings). note stays attached.
screen click 2 → bezel gets `screen-tap-2` → CSS `liora-stickynote-ripfall` + `liora-stickynote-tape-rip` (identical to prior v6 fall, now gated behind second click).
clicking sticky note itself during sway or fall → embed adds `liora-stickynote--flying-out` on the element → CSS `liora-stickynote-flyout` keyframe zooms to 5x fixed-position. tapCount is set to 3 to suppress further screen cracks.

CSS class ownership:

- bezel state classes (`screen-tap-1`, `screen-tap-2`, `screen-tap-3`): embed adds/removes
- sticky note element class (`liora-stickynote--flying-out`): embed adds, refreshScene removes

pointer-events: base `.liora-stickynote` has `pointer-events: none`. bezel state rule `.liora-bezel.screen-tap-1 .liora-stickynote` and `.liora-bezel.screen-tap-2 .liora-stickynote` each set `pointer-events: auto` so the fly-out click can land. `.liora-stickynote--flying-out` resets to `pointer-events: none` (note is "held", done interacting).

React handleStickyToggle guard: bails out if `.liora-bezel` has `screen-tap-1` or `screen-tap-2` so the v6 zoom doesn't conflict with the fly-out path during sway/fall.

refreshScene cleanup: removes `liora-stickynote--flying-out` from note element, resets tapCount to 0.

fly-out CSS uses `position: fixed !important` + `inset: 0 !important` + `margin: auto !important` to center in viewport. perspective(600px) on keyframe matches the 3d name flyout aesthetic from commit 3dbbfa44.

shatter fallback (tap-3 `screen-tap-3`): unchanged — no-op in normal flow since by tap-3 the note is already gone (either fell or flew out).

**Why:** bryan's spec — two screen cracks before fall, note stays alive (swaying) after first crack to build tension. sticky note click mid-sway/fall is the "pick up and read" interaction.

**How to apply:** if further sticky note animation changes needed, the state machine lives in liora-embed.ts (tapCount logic + fly-out listener) and styles.css (keyframes + class rules). both files must be touched together for any state change.
