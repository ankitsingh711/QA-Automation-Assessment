import type { Page } from '@playwright/test';
import type { LegacyLocator } from '../src/pages/legacy/LegacyDashboardPage';
import { lintSpec, toLocator, type LocatorSpec } from './locatorSpec';

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: Check[];
}

const RUPEES = /^₹[\d,]+$/;

/**
 * Gates a suggested locator must clear before it is even proposed to a human.
 * `openFreshPage` gives each candidate a clean page because the behaviour check clicks/types.
 */
export async function validateCandidate(openFreshPage: () => Promise<Page>, locator: LegacyLocator, spec: LocatorSpec, minConfidence: number, confidence: number): Promise<ValidationResult> {
  const checks: Check[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    checks.push({ name, ok, detail });
    return ok;
  };
  let page: Page | undefined;
  const done = async () => {
    await page?.close();
    return { passed: checks.every((c) => c.ok), checks };
  };

  // 1. Static: allow-listed strategy/role, nothing positional.
  const lint = lintSpec(spec);
  if (!record('Resilient strategy (no CSS/XPath/positional)', lint.length === 0, lint.join('; ') || `${spec.strategy} locator`)) return done();

  // 2. Confidence floor — low-confidence guesses go to a human as "needs investigation", not as a fix.
  if (!record('Confidence threshold', confidence >= minConfidence, `${confidence} (min ${minConfidence})`)) return done();

  page = await openFreshPage();
  const target = toLocator(page, spec);

  // 3. Resolves to exactly one element — Playwright strict mode would throw otherwise.
  const count = await target.count();
  if (!record('Resolves to exactly one element', count === 1, `matched ${count}`)) return done();

  // 4. Visible to the user.
  if (!record('Visible', await target.isVisible(), 'isVisible()')) return done();

  // 5. Same kind of element as when the test last passed (fingerprint).
  const facts = await target.evaluate((el) => ({
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    type: el.getAttribute('type'),
    text: (el.textContent ?? '').trim(),
  }));
  const kindOk = {
    value: RUPEES.test(facts.text),
    button: facts.tag === 'button' || facts.role === 'button',
    input: facts.tag === 'input' && facts.type !== 'range',
    tab: facts.role === 'tab',
  }[locator.kind];
  if (!record(`Fingerprint matches "${locator.kind}"`, kindOk, JSON.stringify(facts))) return done();

  // 5b. Anchored to the same label as last time — catches "right kind, wrong card".
  if (locator.lastKnownLabel) {
    const label = await target.evaluate((el) => el.closest('article, section, li, figure')?.querySelector('h1, h2, h3, h4')?.textContent?.trim() ?? null);
    const anchored = label?.toLowerCase() === locator.lastKnownLabel.toLowerCase();
    if (!record('Anchored to last-known label', anchored, `card heading "${label}", expected "${locator.lastKnownLabel}"`)) return done();
  }

  // 6. Behaviour: the action the test performs actually works on this element.
  try {
    switch (locator.kind) {
      case 'button':
        await target.click({ timeout: 3000 });
        record('Behaviour: clickable', true, 'click() succeeded');
        break;
      case 'input':
        await target.fill('3000000', { timeout: 3000 });
        record('Behaviour: accepts input', (await target.inputValue()) === '3000000', `inputValue() = ${await target.inputValue()}`);
        break;
      case 'tab':
        await target.click({ timeout: 3000 });
        record('Behaviour: becomes selected', (await target.getAttribute('aria-selected')) === 'true', `aria-selected = ${await target.getAttribute('aria-selected')}`);
        break;
      case 'value':
        record('Behaviour: readable rupee amount', RUPEES.test((await target.textContent()) ?? ''), `textContent() = ${await target.textContent()}`);
        break;
    }
  } catch (error) {
    record('Behaviour check', false, (error as Error).message.split('\n')[0]);
  }
  return done();
}
