// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import React from 'react';

/**
 * Create a Shell mock that includes LocaleProvider wrapping.
 * 
 * This is the standard pattern for mocking Shell in page tests. The key insight:
 * Shell renders LocaleProvider as a wrapper, so any component using useTranslation()
 * MUST be inside Shell to access the context. The mock must preserve this structure.
 * 
 * @param importDepth - Number of "../" needed to reach src/ from test file location
 *                      (e.g., 3 for src/pages/home/__tests__/, 4 for src/pages/learning/api/__tests__/)
 * 
 * @example
 * // In src/pages/home/__tests__/app.test.tsx:
 * vi.mock('../../../layouts/shell', () => createShellMock(3));
 * 
 * // In src/pages/learning/api/__tests__/app.test.tsx:
 * vi.mock('../../../../layouts/shell', () => createShellMock(4));
 */
export function createShellMock(importDepth: number) {
  const contextPath = '../'.repeat(importDepth) + 'contexts/locale-context';
  
  return {
    default: ({ children, breadcrumbs }: { children: React.ReactNode; breadcrumbs?: React.ReactNode }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { LocaleProvider } = require(contextPath);
      return React.createElement(
        LocaleProvider,
        { locale: 'us' },
        React.createElement('div', { 'data-testid': 'shell' }, breadcrumbs, children)
      );
    },
  };
}

/**
 * Create standard Navigation mock
 * @param importDepth - Number of "../" needed to reach src/ from test file location
 */
export function createNavigationMock(importDepth: number) {
  return {
    default: () => React.createElement('nav', { 'data-testid': 'navigation' }),
  };
}

/**
 * Create standard Breadcrumbs mock that renders active.text for locale testing
 * @param importDepth - Number of "../" needed to reach src/ from test file location
 */
export function createBreadcrumbsMock(importDepth: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyProps = Record<string, any>;
  
  return {
    default: ({ active }: AnyProps) =>
      React.createElement(
        'nav',
        { 'aria-label': 'breadcrumbs' },
        React.createElement('span', { 'data-testid': 'breadcrumb-active' }, active?.text)
      ),
  };
}
