# AI self-healing locators

This document covers the self-healing exercise: the broken locators, how I would heal them with AI, and the working proof of concept in [`self-healing/`](../self-healing/).

## 1. The broken locators

[`src/pages/legacy/LegacyDashboardPage.ts`](../src/pages/legacy/LegacyDashboardPage.ts) models the dashboard the way an older, recorder-generated suite saw it. Its five locators are **left broken on purpose**. Each one is used by a scenario in [`features/self-healing/legacy-locators.feature`](../features/self-healing/legacy-locators.feature). Those scenarios are tagged `@self-healing`, which keeps them out of the regression gate. Run them with `npm run test:self-healing`.

| Key | Broken selector | Why it broke | Real-world pattern |
|---|---|---|---|
| `emiValue` | `xpath=/html/body/div[1]/main/div[2]/div[1]/span` | A header and section wrappers were added above it | Absolute, index-based XPath from a recorder |
| `calculateButton` | `#btn-calculate` | The generated id was removed in a form refactor | Coupling to implementation ids |
| `totalPaymentValue` | `div.summary-cards > div:nth-child(3) > span.value` | Cards became `<article>` and the value became `<p>` | Positional CSS chain tied to tags and classes |
| `loanAmountInput` | `input[name="principal"]` | The form field was renamed from `principal` to `amount` | Coupling to backend field names |
| `homeLoanTab` | `text="Home Loans"` | The UI copy changed to "Home Loan" | Exact match on copy (even text locators break) |

Each locator carries metadata. The healer depends on it, and on the selector itself only as a hint:

- **`intent`**: what the element is *for*, in plain language. A selector says where an element was; the intent says what it is. This is the main input to the model.
- **`kind`**: a coarse fingerprint (`value`, `button`, `input` or `tab`) recorded when the test last passed.
- **`lastKnownLabel`**: for read-only values, the heading of the card the value sat in. Section 5 explains why this field exists.

## 2. Detection

Healing starts only when we're sure the *locator* is the problem, not the app.

1. **At runtime (in the suite):** a step fails with a Playwright `TimeoutError` or strict-mode violation *on a locator*. These failures are distinguishable from assertion failures (`expect(...)` mismatches), which point at the app or the test logic. Only locator failures should go to the healer.
2. **In the healer (`npm run heal`):** for each registered locator, the healer opens the page and runs the old selector the way the test would (`waitFor({ state: 'visible' })`). It records Playwright's own error message, which is part of the prompt. A selector that matches zero elements is *broken*. One that matches several is *ambiguous*, and is treated the same way.
3. **Not healed:** assertion failures, navigation errors and 5xx responses. "Healing" those would hide real bugs. If the old locator still resolves to exactly one visible element, the locator is healthy and gets skipped.

In CI I would run detection on every red build. I'd group locator failures by page object, so one UI refactor produces one healing PR rather than twenty.

## 3. Prompt approach

The prompt lives in [`self-healing/providers/claudeProvider.ts`](../self-healing/providers/claudeProvider.ts). The key decisions:

**What the model sees**
- The intent, expected kind, broken selector and Playwright error.
- **The ARIA snapshot** (`locator('body').ariaSnapshot()`): the page as a user or screen reader perceives it. It's compact, and it naturally steers the model towards role and name locators.
- **A flat list of visible elements** with tag, role, accessible name, `data-testid`, label and the heading of the enclosing card (see [`pageSnapshot.ts`](../self-healing/pageSnapshot.ts)).
- **Not** raw HTML. It's large, noisy and full of styling hooks that tempt a model into suggesting another brittle CSS selector.

**What the model must return**
- Structured output only: up to 3 candidates, each a `LocatorSpec` (`testid | role | label | placeholder | text`), plus a confidence and a one-line rationale. This is enforced with `client.beta.messages.parse` and a Zod schema.
- **The schema cannot express CSS or XPath**, so a positional selector cannot come back even if the model "wants" to return one.
- The model returns **data, not code**. We build the Playwright call ourselves (`toLocator`, `toCode`), so nothing the model writes is ever `eval`'d.

**Instructions that matter**
- Prefer `data-testid`, then role + accessible name, then label; visible text is a last resort.
- Only reference elements that are in the snapshot. Never invent test ids.
- When similar elements compete (several rupee amounts), use the intent and section heading, and *lower confidence*.
- Return nothing if nothing fits: "a wrong locator that passes is worse than a failing one".

**Operational details**
- The system prompt is static and marked for prompt caching, so healing many locators in one run reuses it.
- Model: `claude-opus-5-5` at `effort: medium`, which is plenty for a one-shot structured lookup.
- Server-side refusal fallback (`fallbacks: 'default'`) is enabled, and refusals are surfaced as errors rather than silently ignored.
- Without credentials, an **offline heuristic provider** ranks elements by keyword and phrase overlap with the intent. It exists so the pipeline runs anywhere, including in CI without secrets. The validation gates below are what make either provider's output safe.

## 4. Validation before applying a fix

Every candidate must clear all of these gates ([`validate.ts`](../self-healing/validate.ts)). Each runs on a **fresh page**, because some of them click and type.

| # | Gate | Catches |
|---|---|---|
| 1 | Resilient strategy: allow-listed role, no `nth-child`, `//`, `>>` or `[n]` | Model sneaking positional syntax into a "name" |
| 2 | Confidence ≥ 0.55 (a tie between two elements scores exactly 0.5) | Coin-flip guesses presented as fixes |
| 3 | Resolves to **exactly one** element | Ambiguity that Playwright strict mode would throw on later |
| 4 | Visible | Hidden duplicates, off-screen templates |
| 5 | Fingerprint: same *kind* as last green run (button / input / tab / rupee value) | Healing a button locator onto a heading |
| 5b | Anchored to the **last-known label** for values | Right kind, wrong card (see below) |
| 6 | Behaviour: performs the action the test needs (click, fill + read back, tab becomes selected, value is a readable amount) | Elements that look right but don't work |

**Output, not auto-apply.** The healer never edits `src/`. It writes the following to `reports/self-healing/`:

- `healing-report.md`: every candidate and every gate result
- `healing-suggestions.json`: the machine-readable form
- `LegacyDashboardPage.healed.patch`: a unified diff, plus the patched file

A human reviews the patch. In CI the patch would become a PR, and the full suite runs on it. That last step is the real validation, because it exercises the healed locator inside every scenario that uses it.

## 5. What the POC taught me: a plausible but wrong heal

The first version of the POC "healed" all five locators. But `totalPaymentValue` came back as `getByTestId('total-interest-value')`. It was unique, visible and a rupee amount, so it passed every gate the POC had at that point. The intent mentions both "payment" and "interest", the two cards tied on keywords, and DOM order picked the wrong one.

Worse, **the legacy scenario would have passed with that wrong locator**, because its assertion only checks that the element shows a rupee amount. A self-healing system is only as safe as the assertions that run after it. A "healed" locator plus a weak assertion produces a green test that verifies the wrong thing.

The fixes, in order of importance:

1. **A stronger fingerprint (gate 5b).** Record the label beside the element when it last passed, and require the healed element to sit under the same label. This alone rejected the wrong candidate, and the correct one was accepted next. Production tools such as Healenium store a richer attribute snapshot from the last green run for exactly this reason.
2. **Honest confidence.** Confidence is now the margin over the runner-up, so a tie scores 0.5 and is rejected outright instead of being reported as 0.67.
3. **Phrase evidence in the heuristic.** "total payment" appearing as a phrase outweighs "total" and "interest" scattered separately.

## 6. Results

`npm run heal` (offline heuristic provider, no API key on this machine):

| Locator | Proposed | Confidence |
|---|---|---|
| `emiValue` | `getByTestId('emi-value')` | 1.00 |
| `calculateButton` | `getByRole('button', { name: 'Calculate', exact: true })` | 1.00 |
| `totalPaymentValue` | `getByTestId('total-payment-value')` | 0.64 |
| `loanAmountInput` | `getByRole('spinbutton', { name: 'Loan amount (₹)', exact: true })` | 0.78 |
| `homeLoanTab` | `getByRole('tab', { name: 'Home Loan', exact: true })` | 0.75 |

**End-to-end proof:** I applied the generated patch to a scratch copy and ran `npm run test:self-healing`. All 5 scenarios passed, and the original file was then restored so the exercise stays broken. See [`reports/self-healing/healing-report.md`](../reports/self-healing/healing-report.md) for the full gate-by-gate evidence.

The Claude provider type-checks against `@anthropic-ai/sdk` 1.3.0. It was **not** exercised live during development because no API key was available. Run it with `ANTHROPIC_API_KEY=... npm run heal -- --provider=claude`.

## 7. What I would add next

- **Runtime capture.** An `After` hook on locator failures saves the ARIA snapshot and error to disk, so healing works from the exact failing state instead of re-navigating.
- **Fingerprints from the last green run.** Automatically store each locator's resolved element attributes (role, name, test id, nearest label, bounding box) on every passing run, instead of hand-writing `kind` and `lastKnownLabel`.
- **Healing PRs.** One PR per page object, with the gate table in the description, and the full suite run on the PR branch.
- **Metrics.** Healing acceptance rate and post-heal failure rate. A rising heal rate is a signal to fix the app's testability (missing test ids, unstable names), not to heal harder.
