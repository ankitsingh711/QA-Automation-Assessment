import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * ⚠️  AI SELF-HEALING EXERCISE — THESE LOCATORS ARE BROKEN ON PURPOSE. DO NOT FIX BY HAND.
 *
 * This page object models the dashboard as it looked to an older, recorder-generated test
 * suite. Each locator below fails against the current UI for a different, realistic reason.
 * They are exercised by features/self-healing/legacy-locators.feature (tag @self-healing,
 * excluded from the default run) and repaired by the POC in self-healing/ — see
 * docs/SELF_HEALING.md.
 *
 * The `intent` text is what a human would say the locator is *for*. It is the most important
 * input to the healer: a selector says where an element was, the intent says what it is.
 */
export interface LegacyLocator {
  selector: string;
  intent: string;
  /**
   * Coarse fingerprint of the element as it was when the test last passed. The healer uses it to
   * reject candidates that resolve uniquely but to the wrong *kind* of element.
   */
  kind: 'value' | 'button' | 'input' | 'tab';
  /**
   * Heading of the card the element sat in when the test last passed. Needed for read-only values:
   * several summary cards hold a rupee amount, so "kind" alone cannot tell them apart.
   */
  lastKnownLabel?: string;
  /** Why this selector is brittle — documentation only, never shown to the healer. */
  brittleBecause: string;
}

export const LEGACY_LOCATORS = {
  emiValue: {
    kind: 'value',
    lastKnownLabel: 'Monthly EMI',
    selector: 'xpath=/html/body/div[1]/main/div[2]/div[1]/span',
    intent: 'The monthly EMI amount shown in the Summary section of the loan dashboard',
    brittleBecause: 'Absolute, index-based XPath recorded against an older layout; any wrapper element added above it breaks it.',
  },
  calculateButton: {
    kind: 'button',
    selector: '#btn-calculate',
    intent: 'The button that submits the loan details form and recalculates the EMI',
    brittleBecause: 'Relies on a generated id that was removed when the form was refactored.',
  },
  totalPaymentValue: {
    kind: 'value',
    lastKnownLabel: 'Total payment',
    selector: 'div.summary-cards > div:nth-child(3) > span.value',
    intent: 'The total payment (principal + interest) amount shown in the Summary section',
    brittleBecause: 'Positional CSS chain tied to tag names and class names; cards became <article> and the value a <p>.',
  },
  loanAmountInput: {
    kind: 'input',
    selector: 'input[name="principal"]',
    intent: 'The number input where the user types the loan amount in rupees',
    brittleBecause: 'Couples to a form field name that was renamed from "principal" to "amount".',
  },
  homeLoanTab: {
    kind: 'tab',
    selector: 'text="Home Loans"',
    intent: 'The tab that switches the dashboard to the Home Loan calculator',
    brittleBecause: 'Exact-text match on UI copy that changed from "Home Loans" to "Home Loan".',
  },
} as const satisfies Record<string, LegacyLocator>;

export type LegacyLocatorKey = keyof typeof LEGACY_LOCATORS;

/** Fail fast — there is no point waiting the full action timeout for an element that will never appear. */
const LEGACY_TIMEOUT_MS = 3_000;

export class LegacyDashboardPage extends BasePage {
  protected readonly path = '/';

  get emiValue(): Locator { return this.page.locator(LEGACY_LOCATORS.emiValue.selector); }
  get calculateButton(): Locator { return this.page.locator(LEGACY_LOCATORS.calculateButton.selector); }
  get totalPaymentValue(): Locator { return this.page.locator(LEGACY_LOCATORS.totalPaymentValue.selector); }
  get loanAmountInput(): Locator { return this.page.locator(LEGACY_LOCATORS.loanAmountInput.selector); }
  get homeLoanTab(): Locator { return this.page.locator(LEGACY_LOCATORS.homeLoanTab.selector); }

  async readEmiText(): Promise<string> {
    return (await this.emiValue.textContent({ timeout: LEGACY_TIMEOUT_MS })) ?? '';
  }

  async readTotalPaymentText(): Promise<string> {
    return (await this.totalPaymentValue.textContent({ timeout: LEGACY_TIMEOUT_MS })) ?? '';
  }

  async recalculate(): Promise<void> {
    await this.calculateButton.click({ timeout: LEGACY_TIMEOUT_MS });
  }

  async enterLoanAmount(amount: number): Promise<void> {
    await this.loanAmountInput.fill(String(amount), { timeout: LEGACY_TIMEOUT_MS });
  }

  async selectHomeLoan(): Promise<void> {
    await this.homeLoanTab.click({ timeout: LEGACY_TIMEOUT_MS });
  }
}
