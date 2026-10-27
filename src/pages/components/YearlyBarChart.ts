import type { Locator, Page } from '@playwright/test';
import { parseRupees } from '../../utils/currency';

export interface TooltipFigures {
  year: number;
  principal: number;
  interest: number;
  total: number;
  balance: number;
}

/** "Yearly repayment split" card: stacked bar per calendar year with a hover tooltip. */
export class YearlyBarChart {
  readonly chart: Locator;
  readonly bars: Locator;
  readonly tooltip: Locator;
  private readonly barList: Locator;

  constructor(page: Page, root: Locator) {
    this.chart = root.getByRole('figure', { name: 'Yearly principal and interest bar chart' });
    this.barList = root.getByRole('list', { name: 'Yearly principal and interest' });
    this.bars = this.barList.getByRole('listitem');
    // The tooltip is a single shared element, so it is located by role rather than inside a bar.
    this.tooltip = page.getByRole('tooltip');
  }

  /** Each bar's accessible name starts with its year, e.g. "2028: principal ₹1,73,684, interest ₹2,22,769". */
  bar(year: number): Locator {
    return this.barList.getByRole('listitem', { name: new RegExp(`^${year}:`) });
  }

  async barData(): Promise<Array<{ year: number; principal: number; interest: number }>> {
    return this.bars.evaluateAll((nodes) =>
      nodes.map((node) => ({
        year: Number(node.getAttribute('data-year')),
        principal: Number(node.getAttribute('data-principal')),
        interest: Number(node.getAttribute('data-interest')),
      })),
    );
  }

  async hoverBar(year: number): Promise<void> {
    await this.bar(year).hover();
  }

  async readTooltip(): Promise<TooltipFigures> {
    const field = (id: string) => this.tooltip.getByTestId(id).textContent();
    return {
      year: Number(await field('tooltip-year')),
      principal: parseRupees(await field('tooltip-principal')),
      interest: parseRupees(await field('tooltip-interest')),
      total: parseRupees(await field('tooltip-total')),
      balance: parseRupees(await field('tooltip-balance')),
    };
  }
}
