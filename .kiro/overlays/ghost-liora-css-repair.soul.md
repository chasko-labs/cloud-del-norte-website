# ghost-liora-css-repair — cloud-del-norte-website overlay

## tooling

use `read` tool to view files, `write` tool to edit, `glob` to find files
run shell only for: npx biome format, npx biome check, npx vite build

## auth stylesheet

path: src/sites/auth/_layout/styles.css

isolated token block at top: body.cdn-auth-subdomain { --cdn-auth-* }
dark mode: body.cdn-auth-subdomain.awsui-dark-mode { --cdn-auth-* }
card: .cdn-auth-card (clamp width, backdrop-filter, padding)
link override: body.cdn-auth-subdomain:not(#\9):not(#\9):not(#\9) [class*="awsui_link_"]
button: .cdn-auth-card [class*="variant-primary"]
input: .cdn-auth-card [class*="awsui_input-container_"]

## cloudscape specificity

cloudscape uses :not(#\9) for specificity boost — stack multiples to win
class names are hashed: use [class*="awsui_partial-name_"] selectors
v3 link color: var(--awsui-style-color-default-6b9ypa, var(--token, fallback))
override via direct color rule with higher specificity

## build

format: npx biome format --write <file>
lint: npx biome check <file> (warnings OK, errors block)
build: npx vite build --config vite.config.auth.ts
noDescendingSpecificity = warn, noImportantStyles = error

## file map

auth entry points: src/sites/auth/{login,signup,verify,forgot-password}/app.tsx
auth layout: src/sites/auth/_layout/index.tsx
auth styles: src/sites/auth/_layout/styles.css
global tokens: src/styles/tokens.css
glass primitives: src/styles/cdn-glass-streaks.css
shell: src/layouts/shell/index.tsx + styles.css
locales: src/locales/{en-US,es-MX}.json
