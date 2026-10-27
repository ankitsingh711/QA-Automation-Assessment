import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { TestWorld } from '../support/world';
import { comparisonTable, expectRupees } from '../support/assertions';
import { summarise } from '../utils/loanCalculator';
import type { LoanField } from '../pages/DashboardPage';
import type { SliceKey } from '../pages/components/DonutChart';

const RUPEES = /^₹[\d,]+$/;

Given('I am on the loan dashboard', async function (this: TestWorld) {
  await this.dashboard.open();
  await expect(this.dashboard.mainHeading).toHaveText('Loan dashboard');
});

Then('the loan dashboard should be displayed', async function (this: TestWorld) {
  const { dashboard, currentPage } = this;
  await expect(currentPage).toHaveTitle(/Dashboard/);
  await expect(dashboard.navLink('Dashboard')).toHaveAttribute('aria-current', 'page');
  await expect(dashboard.loanTypeTabs.getByRole('tab')).toHaveText(['Home Loan', 'Personal Loan', 'Car Loan']);
  await expect(dashboard.form).toBeVisible();
  await expect(dashboard.summary).toBeVisible();
  await expect(dashboard.breakdown.chart).toBeVisible();
});

Then('the {string} tab should be selected', async function (this: TestWorld, name: string) {
  await expect(this.dashboard.tab(name)).toHaveAttribute('aria-selected', 'true');
});

Then('the summary should show a monthly EMI, total interest and total payment', async function (this: TestWorld) {
  await expect(this.dashboard.emiValue).toHaveText(RUPEES);
  await expect(this.dashboard.totalInterestValue).toHaveText(RUPEES);
  await expect(this.dashboard.totalPaymentValue).toHaveText(RUPEES);
});

When('I select the {string} tab', async function (this: TestWorld, name: string) {
  await this.dashboard.selectLoanType(name);
  await expect(this.dashboard.tab(name)).toHaveAttribute('aria-selected', 'true');
});

When('I calculate a loan of {int} rupees at {float}% for {int} years', async function (this: TestWorld, principal: number, annualRatePct: number, tenureYears: number) {
  this.loan = { principal, annualRatePct, tenureYears };
  await this.dashboard.calculate(this.loan);
});

When('I move the {string} slider to {int}', async function (this: TestWorld, field: LoanField, value: number) {
  await this.dashboard.setSlider(field, value);
});

Then('the {string} input should show {int}', async function (this: TestWorld, field: LoanField, value: number) {
  await expect(this.dashboard.input(field)).toHaveValue(String(value));
});

async function assertSummaryMatchesOracle(world: TestWorld): Promise<void> {
  const expected = summarise(world.expectedLoan);
  await expectRupees(world.dashboard.emiValue, expected.emi, 'Monthly EMI');
  await expectRupees(world.dashboard.totalInterestValue, expected.totalInterest, 'Total interest');
  await expectRupees(world.dashboard.totalPaymentValue, expected.totalPayment, 'Total payment');

  const shown = await world.dashboard.readSummary();
  world.attach(
    `Loan: ${JSON.stringify(world.expectedLoan)}\n\n` +
      comparisonTable([
        ['Monthly EMI', expected.emi, shown.emi],
        ['Total interest', expected.totalInterest, shown.totalInterest],
        ['Total payment', expected.totalPayment, shown.totalPayment],
      ]),
    'text/plain',
  );
}

Then('the summary should match my own calculation for the values in the form', async function (this: TestWorld) {
  this.loan = await this.dashboard.currentInputs();
  await assertSummaryMatchesOracle(this);
});

Then('the monthly EMI should match my independently calculated EMI', async function (this: TestWorld) {
  await expectRupees(this.dashboard.emiValue, summarise(this.expectedLoan).emi, 'Monthly EMI');
});

Then('the total interest and total payment should match my independently calculated values', async function (this: TestWorld) {
  await assertSummaryMatchesOracle(this);
});

// ---- Pie chart --------------------------------------------------------------------------------

Then('the payment breakdown pie chart should be visible', async function (this: TestWorld) {
  const { breakdown } = this.dashboard;
  await expect(breakdown.chart).toBeVisible();
  for (const key of ['principal', 'interest'] as SliceKey[]) {
    await expect(breakdown.slice(key)).toBeVisible();
  }
  const box = await breakdown.chart.boundingBox();
  expect(box?.width ?? 0, 'pie chart width').toBeGreaterThan(0);
  expect(box?.height ?? 0, 'pie chart height').toBeGreaterThan(0);
  this.attach(await breakdown.chart.screenshot(), 'image/png');
});

Then('both pie chart segments should have values greater than zero', async function (this: TestWorld) {
  const { breakdown } = this.dashboard;
  const extracted: string[] = [];
  for (const key of ['principal', 'interest'] as SliceKey[]) {
    const value = await breakdown.sliceValue(key);
    const arc = await breakdown.sliceArcLength(key);
    extracted.push(`${key}: value=${value}, drawn arc length=${arc.toFixed(2)}`);
    expect(Number.isFinite(value), `${key} segment value should be numeric`).toBe(true);
    expect(value, `${key} segment value`).toBeGreaterThan(0);
    expect(arc, `${key} segment should be drawn with a non-zero arc`).toBeGreaterThan(0);
  }
  this.attach(`Extracted pie chart values\n${extracted.join('\n')}`, 'text/plain');
});

Then('the principal segment should equal the loan amount', async function (this: TestWorld) {
  expect(await this.dashboard.breakdown.sliceValue('principal')).toBe(this.expectedLoan.principal);
});

Then('the interest segment should equal my independently calculated total interest', async function (this: TestWorld) {
  expect(await this.dashboard.breakdown.sliceValue('interest')).toBe(summarise(this.expectedLoan).totalInterest);
});

Then('the pie chart legend should show the same values as the segments', async function (this: TestWorld) {
  const { breakdown } = this.dashboard;
  for (const key of ['principal', 'interest'] as SliceKey[]) {
    expect(await breakdown.legendAmount(key), `${key} legend`).toBe(await breakdown.sliceValue(key));
  }
});

// ---- Validation -------------------------------------------------------------------------------

Then('I should see the validation message {string}', async function (this: TestWorld, message: string) {
  await expect(this.dashboard.validationMessage).toHaveText(message);
});

Then('the summary figures should be cleared', async function (this: TestWorld) {
  for (const value of [this.dashboard.emiValue, this.dashboard.totalInterestValue, this.dashboard.totalPaymentValue]) {
    await expect(value).toHaveText('—');
  }
});

Then('the pie chart should be replaced by an empty-state message', async function (this: TestWorld) {
  await expect(this.dashboard.breakdown.chart).toBeHidden();
  await expect(this.dashboard.chartEmptyState).toBeVisible();
});
