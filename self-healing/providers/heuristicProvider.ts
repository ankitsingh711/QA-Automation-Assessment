import type { LegacyLocator } from '../../src/pages/legacy/LegacyDashboardPage';
import type { LocatorSpec } from '../locatorSpec';
import type { CandidateElement } from '../pageSnapshot';
import type { HealingProvider, HealingRequest, Suggestion } from './types';

/**
 * Offline fallback used when no Claude credentials are configured (and in CI dry runs).
 * It ranks visible elements by word overlap with the locator's intent and old selector,
 * restricted to elements of the expected kind. Crude, deterministic and free — the
 * validation gates downstream are what make its output safe to suggest.
 */
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'and', 'that', 'shown', 'where', 'user', 'types', 'section', 'value', 'div', 'span', 'input', 'text', 'name', 'xpath', 'html', 'body', 'main', 'child', 'nth']);

function words(text: string | null | undefined): string[] {
  return (text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** "recalculates" ~ "calculate", "loans" ~ "loan". */
const similar = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));

const RUPEES = /^₹[\d,]+$/;

function matchesKind(kind: LegacyLocator['kind'], el: CandidateElement): boolean {
  switch (kind) {
    case 'value':
      return RUPEES.test(el.text) && !el.role;
    case 'button':
      return el.role === 'button';
    case 'input':
      return el.role === 'spinbutton' || el.role === 'textbox';
    case 'tab':
      return el.role === 'tab';
  }
}

function specFor(el: CandidateElement): LocatorSpec {
  if (el.testId) return { strategy: 'testid', role: null, value: el.testId, exact: true };
  if (el.role && el.name) return { strategy: 'role', role: el.role, value: el.name, exact: true };
  if (el.label) return { strategy: 'label', role: null, value: el.label, exact: true };
  return { strategy: 'text', role: null, value: el.text, exact: true };
}

export class HeuristicProvider implements HealingProvider {
  readonly name = 'heuristic (offline)';

  async suggest({ locator, snapshot }: HealingRequest): Promise<Suggestion[]> {
    const intentWords = words(locator.intent);
    const selectorWords = words(locator.selector);

    const scored = snapshot.candidates
      .filter((el) => matchesKind(locator.kind, el))
      .map((el) => {
        const haystack = words([el.name, el.testId, el.label, el.context].join(' '));
        const hits = (needles: string[]) => needles.filter((n) => haystack.some((h) => similar(n, h))).length;
        // Adjacent intent words appearing together ("total payment") are far stronger evidence than either word alone.
        const joined = ` ${haystack.join(' ')} `;
        const phraseHits = intentWords.slice(1).filter((w, i) => joined.includes(` ${intentWords[i]} ${w} `)).length;
        const score = 2 * hits(intentWords) + hits(selectorWords) + 3 * phraseHits;
        return { el, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    // Confidence reflects the margin over the strongest competitor: a tie scores 0.5, a lone match 1.0.
    return scored.slice(0, 3).map(({ el, score }, i) => ({
      spec: specFor(el),
      confidence: Number((score / (score + (i === 0 ? scored[1]?.score ?? 0 : scored[0].score))).toFixed(2)),
      rationale: `Matched ${score} weighted keyword(s) from the intent/selector against ${el.testId ? `data-testid "${el.testId}"` : `${el.role} "${el.name}"`}${el.context ? ` in "${el.context}"` : ''}.`,
    }));
  }
}
