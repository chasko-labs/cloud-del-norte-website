---
description: "Use when creating new pages, adding components, writing React/TSX code, modifying navigation, or working with Cloudscape Design System in this MPA project."
applyTo: "src/**/*.{tsx,ts}"
---

# Cloudscape MPA Conventions

## Architecture: Multi-Page App (NOT SPA)

Each page is an independent Vite entry point. There is no React Router.

### Page anatomy — every page needs exactly 3 files:

```
src/pages/<name>/
  index.html    ← Vite HTML entry (script src: /<name>/main.tsx)
  main.tsx      ← mounts React root, imports global styles + tokens
  app.tsx       ← page component tree wrapped in Shell
```

### main.tsx boilerplate (identical across pages):

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@cloudscape-design/global-styles/index.css';
import '../../styles/tokens.css';
import App from './app';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### app.tsx pattern — always includes theme state and Shell:

```tsx
import { useState } from 'react';
import Shell from '../../layouts/shell';
import Navigation from '../../components/navigation';
import Breadcrumbs from '../../components/breadcrumbs';
import { initializeTheme, applyTheme, setStoredTheme, type Theme } from '../../utils/theme';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => initializeTheme());
  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
    setStoredTheme(newTheme);
  };

  return (
    <Shell
      theme={theme}
      onThemeChange={handleThemeChange}
      breadcrumbs={<Breadcrumbs active={{ text: 'Page Title', href: '/<name>/index.html' }} />}
      navigation={<Navigation />}
    >
      {/* page content */}
    </Shell>
  );
}
```

### Registering a new page:

1. Add entry to `vite.config.ts` → `build.rollupOptions.input`
2. Add nav item in `src/components/navigation/index.tsx` → `items` array

## Cloudscape Imports

Always use **deep imports** for tree-shaking:

```tsx
// CORRECT
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';

// WRONG — never use barrel imports
import { Button, Table } from '@cloudscape-design/components';
```

## Navigation

All pages share `src/components/navigation/index.tsx`. Never create per-page navigation components. To add a nav item, append to the `items` array in that file.

## No Path Aliases

All imports use relative paths. No `baseUrl`/`paths` in tsconfig.
