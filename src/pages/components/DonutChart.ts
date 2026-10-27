import type { Locator } from '@playwright/test';
import { parseRupees } from '../../utils/currency';

export type SliceKey = 'principal' | 'interest';

/** "Payment breakdown" card: donut chart + legend. Scoped to its region so locators stay local. */
export class DonutChart {
  readonly chart: Locator;

  constructor(private readonly root: Locator) {
    this.chart = root.getByRole('img', { name: 'Principal vs interest pie chart' });
  }

  slice(key: SliceKey): Locator {
    return this.root.getByTestId(`pie-slice-${key}`);
  }

  legendValue(key: SliceKey): Locator {
    return this.root.getByTestId(`legend-${key}-value`);
  }

  async sliceValue(key: SliceKey): Promise<number> {
    return Number(await this.slice(key).getAttribute('data-value'));
  }

  /** Length of the drawn arc in SVG units — proves the slice is actually painted, not just present. */
  async sliceArcLength(key: SliceKey): Promise<number> {
    const dash = await this.slice(key).getAttribute('stroke-dasharray');
    return Number((dash ?? '0').split(/\s+/)[0]);
  }

  async legendAmount(key: SliceKey): Promise<number> {
    return parseRupees(await this.legendValue(key).textContent());
  }
}
