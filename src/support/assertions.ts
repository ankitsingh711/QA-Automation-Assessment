import { expect, type Locator } from '@playwright/test';
import { parseRupees, RUPEE_TOLERANCE } from '../utils/currency';

/**
 * Web-first assertion for a rupee figure: polls until the displayed amount is within
 * `tolerance` of the expected value, so it is safe against re-renders after input.
 */
export async function expectRupees(locator: Locator, expected: number, label: string, tolerance = 0): Promise<void> {
  await expect
    .poll(async () => Math.abs(parseRupees(await locator.textContent()) - expected), {
      message: `${label}: expected ≈ ₹${expected.toLocaleString('en-IN')} (±${tolerance}), got "${await locator.textContent()}"`,
    })
    .toBeLessThanOrEqual(tolerance);
}

export function expectAmountClose(actual: number, expected: number, label: string, tolerance = RUPEE_TOLERANCE): void {
  expect(Math.abs(actual - expected), `${label}: expected ≈ ${expected.toFixed(2)}, got ${actual}`).toBeLessThanOrEqual(tolerance);
}

/** Pretty side-by-side table attached to the Cucumber report as evidence. */
export function comparisonTable(rows: Array<[string, number | string, number | string]>): string {
  const header = ['Check', 'Expected (independent)', 'Displayed'];
  const all = [header, ...rows.map((r) => r.map(String))];
  const widths = header.map((_, i) => Math.max(...all.map((r) => r[i].length)));
  return all.map((r) => r.map((c, i) => c.padEnd(widths[i])).join(' | ')).join('\n');
}
