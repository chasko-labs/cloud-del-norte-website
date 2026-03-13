---
description: 'Use when writing or modifying Vitest test files for Cloudscape Design System components, page tests, utility tests for AWS UG Cloud Del Norte.'
applyTo: '**/*.test.{ts,tsx}'
---

# Testing Conventions

## Framework & Environment

- **Vitest** with **jsdom** environment
- **@testing-library/react** component rendering
- Global setup in `src/test/setup.ts` handles `ResizeObserver` `matchMedia` mocks
  `

## Test File Location

Colocate tests with source using `__tests__/` directories:

```
src/pages/<name>/
  __tests__/
    app.test.tsx
  utils/
    __tests__/
      helper.test.ts
```

## Cloudscape Component Mocking

Cloudscape components use browser APIs (ResizeObserver, timers) that hang in jsdom. Mock components with minimal HTML stand-ins:

```tsx
import React from 'react';
import { vi } from 'vitest';

type AnyProps = Record<string, any>;

vi.mock('@cloudscape-design/components/button', () => ({
  default: ({ children, onClick }: AnyProps) => React.createElement('button', { onClick }, children),
}));

vi.mock('@cloudscape-design/components/header', () => ({
  default: ({ children, actions, variant }: AnyProps) =>
    React.createElement('div', null, React.createElement(variant === 'h2' ? 'h2' : 'h1', null, children), actions),
}));

vi.mock('@cloudscape-design/components/content-layout', () => ({
  default: ({ children, header }: AnyProps) => React.createElement('div', null, header, children),
}));

vi.mock('@cloudscape-design/components/space-between', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));

vi.mock('@cloudscape-design/components/box', () => ({
  default: ({ children }: AnyProps) => React.createElement('div', null, children),
}));

vi.mock('@cloudscape-design/components/badge', () => ({
  default: ({ children }: AnyProps) => React.createElement('span', null, children),
}));

vi.mock('@cloudscape-design/components/link', () => ({
  default: ({ children, href }: AnyProps) => React.createElement('a', { href }, children),
}));
```

### Shell & Navigation Mocks

Always mock the Shell layout, Navigation, Breadcrumbs — they depend on AppLayout which hangs in jsdom:

```tsx
vi.mock('../../../layouts/shell', () => ({
  default: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'shell' }, children),
}));

vi.mock('../../../components/navigation', () => ({
  default: () => React.createElement('nav', { 'data-testid': 'navigation' }),
}));

vi.mock('../../../components/breadcrumbs', () => ({
  default: () => React.createElement('nav', { 'aria-label': 'breadcrumbs' }),
}));
```

### Table Mock (with column rendering)

For Table-heavy pages, mock with column cell rendering support:

```tsx
vi.mock('@cloudscape-design/components/table', () => ({
  default: ({ header, items, columnDefinitions }: AnyProps) =>
    React.createElement(
      'div',
      { 'data-testid': 'table' },
      header,
      items.map((_: unknown, i: number) =>
        React.createElement(
          'div',
          { key: i, 'data-testid': 'table-row' },
          columnDefinitions.map((col: AnyProps) =>
            React.createElement('div', { key: col.id, 'data-testid': `cell-${col.id}` }, col.cell(items[i])),
          ),
        ),
      ),
    ),
}));
```

## Browser API Mocks

Mock browser APIs not available in jsdom as needed per test file:

```tsx
globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
globalThis.URL.revokeObjectURL = vi.fn();
```

## Test Structure

- Use `describe`/`it` blocks with descriptive names
- Suppress verify console errors when testing for clean renders:

```tsx
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

it('no React warnings or errors on render', () => {
  render(<Component />);
  const errorCalls = consoleErrorSpy.mock.calls.filter(
    (args: unknown[]) => typeof args[0] === 'string' && (args[0].includes('Warning:') || args[0].includes('Error:')),
  );
  expect(errorCalls).toHaveLength(0);
});
```

## Pure Utility Tests

Utility functions without Cloudscape dependencies need no mocks — test directly:

```tsx
import { describe, it, expect } from 'vitest';
import { myUtil } from '../myUtil';

describe('myUtil', () => {
  it('does the thing', () => {
    expect(myUtil(input)).toBe(expected);
  });
});
```

## Build Output Smoke Tests

For verifying build artifacts exist after `npm run build`:

```tsx
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

it('page index.html exists in lib/', () => {
  expect(existsSync(join(LIB, '<page>/index.html'))).toBe(true);
});
```

## Commands

```bash
npm test              # vitest run (single pass)
npm run test:watch    # vitest (watch mode)
npm run test:ui       # vitest --ui (browser UI)
npm run coverage      # vitest run --coverage
```
