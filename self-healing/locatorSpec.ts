import { z } from 'zod';
import type { Locator, Page } from '@playwright/test';

/**
 * A healed locator is DATA, never code. Whatever the model suggests is parsed into this shape and
 * turned into a Playwright call by us — no LLM-written code is ever eval'd.
 * CSS/XPath are deliberately not representable, so a positional selector cannot come back.
 */
export const LocatorSpecSchema = z.object({
  strategy: z.enum(['testid', 'role', 'label', 'placeholder', 'text']).describe('Playwright locator family to use'),
  role: z.string().nullable().describe('ARIA role, required when strategy is "role", otherwise null'),
  value: z.string().describe('The data-testid, accessible name, label text, placeholder or visible text'),
  exact: z.boolean().describe('Whether the name/text must match exactly'),
});
export type LocatorSpec = z.infer<typeof LocatorSpecSchema>;

type AriaRole = Parameters<Page['getByRole']>[0];

const ALLOWED_ROLES = new Set<string>([
  'alert', 'button', 'cell', 'checkbox', 'columnheader', 'combobox', 'figure', 'form', 'heading', 'img', 'link',
  'list', 'listitem', 'navigation', 'radio', 'region', 'row', 'rowheader', 'slider', 'spinbutton', 'tab', 'table',
  'tablist', 'tabpanel', 'textbox', 'tooltip',
]);

/** Static checks that need no browser: allow-listed role, non-empty value, no selector syntax smuggled in. */
export function lintSpec(spec: LocatorSpec): string[] {
  const problems: string[] = [];
  if (spec.strategy === 'role' && (!spec.role || !ALLOWED_ROLES.has(spec.role))) problems.push(`role "${spec.role}" is not an allowed ARIA role`);
  if (!spec.value.trim()) problems.push('empty value');
  if (/nth-child|nth=|xpath|\/\/|>>|\[\d+\]|^[.#]/i.test(spec.value)) problems.push(`value "${spec.value}" looks like a positional CSS/XPath selector`);
  return problems;
}

export function toLocator(page: Page, spec: LocatorSpec): Locator {
  switch (spec.strategy) {
    case 'testid':
      return page.getByTestId(spec.value);
    case 'role':
      return page.getByRole(spec.role as AriaRole, { name: spec.value, exact: spec.exact });
    case 'label':
      return page.getByLabel(spec.value, { exact: spec.exact });
    case 'placeholder':
      return page.getByPlaceholder(spec.value, { exact: spec.exact });
    case 'text':
      return page.getByText(spec.value, { exact: spec.exact });
  }
}

const q = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Source code for the page object, e.g. getByRole('button', { name: 'Calculate', exact: true }). */
export function toCode(spec: LocatorSpec): string {
  const exact = spec.exact ? ', exact: true' : '';
  switch (spec.strategy) {
    case 'testid':
      return `getByTestId(${q(spec.value)})`;
    case 'role':
      return `getByRole(${q(spec.role ?? '')}, { name: ${q(spec.value)}${exact} })`;
    case 'label':
      return `getByLabel(${q(spec.value)}${spec.exact ? ', { exact: true }' : ''})`;
    case 'placeholder':
      return `getByPlaceholder(${q(spec.value)}${spec.exact ? ', { exact: true }' : ''})`;
    case 'text':
      return `getByText(${q(spec.value)}${spec.exact ? ', { exact: true }' : ''})`;
  }
}
