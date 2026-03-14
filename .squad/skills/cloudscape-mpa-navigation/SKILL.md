# Skill: Cloudscape MPA Navigation Pattern

**Domain:** Cloudscape Design System + Multi-Page App Architecture  
**Created:** 2026-03-14  
**Author:** Lyren (Cloudscape UI Specialist)  
**Applies to:** Any MPA using Cloudscape SideNavigation

---

## Problem

Cloudscape's `SideNavigation` component is designed for SPAs (Single-Page Apps) where navigation is handled by client-side routing (React Router, etc.). In an MPA (Multi-Page App), clicking nav links causes a full page reload, which can corrupt React state if not handled correctly.

**Symptom:** Navigation drawer disappears or becomes unresponsive when links are clicked.

## Solution Pattern

Always provide an explicit `onFollow` handler that prevents default behavior and manually triggers page navigation:

```tsx
import SideNavigation from '@cloudscape-design/components/side-navigation';

export default function Navigation() {
  return (
    <SideNavigation
      activeHref={location.pathname}
      header={{ href: '/home/index.html', text: 'Home' }}
      items={[
        { type: 'link', text: 'Page 1', href: '/page1/index.html' },
        { type: 'link', text: 'Page 2', href: '/page2/index.html' },
      ]}
      onFollow={(event) => {
        // Prevent default to avoid React state issues, then navigate manually
        if (!event.detail.external) {
          event.preventDefault();
          window.location.href = event.detail.href;
        }
      }}
    />
  );
}
```

## Why It Works

1. **`event.preventDefault()`** — Stops Cloudscape's default link handling, which expects SPA client-side routing
2. **`window.location.href = event.detail.href`** — Triggers a clean full-page reload, respecting MPA architecture
3. **`!event.detail.external` check** — Allows external links (if any) to use default browser behavior

## When to Use

- ✅ **Any MPA** using Cloudscape SideNavigation
- ✅ When each page is a separate Vite/Webpack entry point
- ✅ When there's no React Router or client-side routing

## When NOT to Use

- ❌ SPAs with React Router — use `Link` component with `to` prop instead
- ❌ SPAs with Next.js — use `next/link` wrapper
- ❌ If you want Cloudscape's default SPA behavior

## Common Mistakes

### ❌ Missing onFollow handler entirely
```tsx
<SideNavigation items={items} />
// Result: Navigation drawer disappears on click
```

### ❌ Using preventDefault without manual navigation
```tsx
onFollow={(event) => {
  event.preventDefault();
  // Forgot window.location.href — nothing happens
}}
```

### ❌ Not checking for external links
```tsx
onFollow={(event) => {
  event.preventDefault(); // Blocks ALL links, including external
  window.location.href = event.detail.href;
}}
// Fix: Add if (!event.detail.external) check
```

## Related Cloudscape Patterns

### TopNavigation in MPA
If using `TopNavigation` with links, apply the same pattern:

```tsx
<TopNavigation
  identity={{ title: 'My App', href: '/home/index.html' }}
  utilities={[
    { type: 'button', text: 'Settings', href: '/settings/index.html' }
  ]}
  onFollow={(event) => {
    if (!event.detail.external) {
      event.preventDefault();
      window.location.href = event.detail.href;
    }
  }}
/>
```

### BreadcrumbGroup in MPA
Same pattern for breadcrumb navigation:

```tsx
<BreadcrumbGroup
  items={[
    { text: 'Home', href: '/home/index.html' },
    { text: 'Current Page', href: '/page/index.html' }
  ]}
  onFollow={(event) => {
    event.preventDefault();
    window.location.href = event.detail.href;
  }}
/>
```

## Testing Strategy

### Unit Tests
No special testing needed — the handler is straightforward. If testing with jsdom, mock `window.location.href`:

```tsx
const mockLocationAssign = vi.fn();
Object.defineProperty(window, 'location', {
  value: { href: mockLocationAssign },
  writable: true
});
```

### Integration Tests
1. Start dev server
2. Click nav links
3. Verify page reloads cleanly
4. Verify drawer stays functional across page navigations

## Architecture Context

**This Project:** Multi-Page App (MPA) — each page is a separate Vite entry point. No React Router.

**Key Files:**
- `src/components/navigation/index.tsx` — Shared SideNavigation component
- `src/layouts/shell/index.tsx` — Shell wraps AppLayout with navigation
- `vite.config.ts` — Defines page entry points

## References

- **Cloudscape Docs:** [SideNavigation API](https://cloudscape.design/components/side-navigation/)
- **Decision:** `.squad/decisions/inbox/lyren-sidenav-onfollow-handler.md`
- **Project Context:** `AGENTS.md` (MPA architecture constraints)

---

**Key Takeaway:** In an MPA using Cloudscape navigation components, ALWAYS provide an `onFollow` handler that prevents default and manually triggers `window.location.href`. This prevents React state corruption and keeps navigation functional.
