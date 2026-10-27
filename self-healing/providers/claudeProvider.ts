import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { LocatorSpecSchema } from '../locatorSpec';
import type { HealingProvider, HealingRequest, Suggestion } from './types';

const SuggestionsSchema = z.object({
  candidates: z
    .array(
      z.object({
        spec: LocatorSpecSchema,
        confidence: z.number().describe('0.0–1.0: how sure you are this is the element the intent describes'),
        rationale: z.string().describe('One sentence: which evidence in the snapshot identifies the element'),
      }),
    )
    .describe('Up to 3 candidates, best first. Empty if no element matches the intent.'),
});

// Stable across calls so the system prompt can be cached when healing many locators in one run.
const SYSTEM_PROMPT = `You repair broken UI locators in a Playwright + Cucumber test suite.

You get: what the element is for (its intent), the selector that stopped working, the Playwright error, and two views of the current page — an ARIA snapshot and a list of visible elements with their test ids and labels.

Find the element that the intent describes and express it as a resilient locator:
- Prefer a data-testid when the element has one that clearly names it.
- Otherwise use its ARIA role plus accessible name; then its form label; visible text is a last resort.
- Never use CSS, XPath, element indexes or anything positional — the next layout change would break it again.
- Only reference elements that appear in the snapshot. Do not invent test ids or names.
- If several elements look similar (for example several rupee amounts), use the intent and the surrounding section heading to pick the right one, and lower your confidence if you are unsure.
- If nothing on the page fits the intent, return no candidates — a wrong locator that passes is worse than a failing one.`;

export class ClaudeProvider implements HealingProvider {
  readonly name = 'claude (claude-opus-5-5)';
  private readonly client = new Anthropic();

  async suggest({ locator, failure, snapshot }: HealingRequest): Promise<Suggestion[]> {
    const user = [
      `Intent: ${locator.intent}`,
      `Expected element kind: ${locator.kind}`,
      `Broken selector: ${locator.selector}`,
      `Playwright error: ${failure}`,
      `Page URL: ${snapshot.url}`,
      '',
      'ARIA snapshot:',
      snapshot.ariaSnapshot,
      '',
      'Visible elements (JSON):',
      JSON.stringify(snapshot.candidates),
    ].join('\n');

    const response = await this.client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Server-side fallback: if a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(SuggestionsSchema) },
    });

    if (response.stop_reason === 'refusal') {
      throw new Error(`Model declined to answer (${response.stop_details?.category ?? 'no category'})`);
    }
    if (!response.parsed_output) {
      throw new Error(`Model response did not match the suggestion schema (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output.candidates;
  }
}
