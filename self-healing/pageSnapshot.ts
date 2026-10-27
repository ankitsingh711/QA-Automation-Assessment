import type { Page } from '@playwright/test';

/** A compact, model-friendly description of one element that could be the target. */
export interface CandidateElement {
  tag: string;
  role: string | null;
  name: string;
  testId: string | null;
  label: string | null;
  text: string;
  /** Heading of the nearest enclosing card/section — disambiguates repeated widgets. */
  context: string | null;
}

export interface PageSnapshot {
  url: string;
  ariaSnapshot: string;
  candidates: CandidateElement[];
}

/**
 * Captures the page the broken locator was looking at. Two views:
 *  - Playwright's ARIA snapshot (what a user / screen reader perceives), and
 *  - a flat list of visible, addressable elements with their test ids and labels.
 * Raw HTML is intentionally not sent: it is large, noisy and full of styling detail that
 * tempts a model into brittle CSS.
 */
export async function capturePage(page: Page): Promise<PageSnapshot> {
  const ariaSnapshot = await page.locator('body').ariaSnapshot();
  const candidates = await page.evaluate(() => {
    const implicitRole = (el: Element): string | null => {
      const explicit = el.getAttribute('role');
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') ?? 'text').toLowerCase();
      if (tag === 'button') return 'button';
      if (tag === 'a' && el.hasAttribute('href')) return 'link';
      if (tag === 'select') return 'combobox';
      if (tag === 'textarea') return 'textbox';
      if (tag === 'input') return ({ number: 'spinbutton', range: 'slider', checkbox: 'checkbox', radio: 'radio' } as Record<string, string>)[type] ?? 'textbox';
      if (/^h[1-6]$/.test(tag)) return 'heading';
      return null;
    };
    const labelFor = (el: Element): string | null => {
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return label.textContent?.trim() ?? null;
      }
      return el.getAttribute('aria-label');
    };
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

    const out: CandidateElement[] = [];
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (!visible(el) || ['SCRIPT', 'STYLE', 'svg', 'title'].includes(el.tagName)) continue;
      const role = implicitRole(el);
      const testId = el.getAttribute('data-testid');
      const isLeafText = el.children.length === 0 && clean(el.textContent).length > 0;
      if (!role && !testId && !isLeafText) continue;

      const container = el.closest('article, section, form, figure');
      const heading = container?.querySelector('h1, h2, h3, h4');
      const label = labelFor(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        role,
        name: clean(label ?? el.getAttribute('aria-label') ?? el.textContent),
        testId,
        label: label ? clean(label) : null,
        text: clean(el.textContent),
        context: heading ? clean(heading.textContent) : null,
      });
    }
    return out.slice(0, 200);
  });
  return { url: page.url(), ariaSnapshot, candidates };
}
