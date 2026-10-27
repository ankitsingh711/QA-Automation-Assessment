/**
 * Steps for the AI self-healing exercise. They go through LegacyDashboardPage, whose locators are
 * broken on purpose — see docs/SELF_HEALING.md. These steps are expected to fail.
 */
import { Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { TestWorld } from '../support/world';

const RUPEES = /^₹[\d,]+$/;

Then('the legacy EMI value should show a rupee amount', async function (this: TestWorld) {
  expect(await this.legacyDashboard.readEmiText()).toMatch(RUPEES);
});

When('I recalculate using the legacy Calculate button', async function (this: TestWorld) {
  await this.legacyDashboard.recalculate();
});

Then('the legacy total payment value should show a rupee amount', async function (this: TestWorld) {
  expect(await this.legacyDashboard.readTotalPaymentText()).toMatch(RUPEES);
});

When('I enter a loan amount of {int} using the legacy loan amount field', async function (this: TestWorld, amount: number) {
  await this.legacyDashboard.enterLoanAmount(amount);
});

When('I select the home loan tab using the legacy tab locator', async function (this: TestWorld) {
  await this.legacyDashboard.selectHomeLoan();
});
