import type { Locator, Page } from '@playwright/test';

export abstract class BasePage {
  /** Path relative to BASE_URL; the absolute URL always comes from config. */
  protected abstract readonly path: string;

  constructor(protected readonly page: Page) {}

  async open(query?: Record<string, string | number>): Promise<void> {
    const search = query ? `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}` : '';
    await this.page.goto(`${this.path}${search}`);
  }

  get mainHeading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }

  navLink(name: string): Locator {
    return this.page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name, exact: true });
  }
}
