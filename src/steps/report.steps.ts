import { Given, Then, When } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import type { TestWorld } from '../support/world';
import { comparisonTable, expectAmountClose, expectRupees } from '../support/assertions';
import { schedule, summarise, yearlyTotals, type Instalment } from '../utils/loanCalculator';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function expectedSchedule(world: TestWorld): Instalment[] {
  if (!world.reportStart) throw new Error('No report has been generated in this scenario yet');
  return schedule(world.expectedLoan, world.reportStart);
}

Given('I am on the amortization report page', async function (this: TestWorld) {
  await this.report.open();
});

Then('the amortization report page should be displayed', async function (this: TestWorld) {
  const { report } = this;
  await expect(report.mainHeading).toHaveText('Amortization report');
  await expect(report.navLink('Amortization report')).toHaveAttribute('aria-current', 'page');
  for (const field of [report.amountInput, report.rateInput, report.tenureInput, report.startMonthInput]) {
    await expect(field).toBeVisible();
  }
  await expect(report.generateButton).toBeEnabled();
});

Then('no report should be shown until I generate one', async function (this: TestWorld) {
  await expect(this.report.output).toBeHidden();
});

When(
  'I generate a report for a loan of {int} rupees at {float}% for {int} years starting {string}',
  async function (this: TestWorld, principal: number, annualRatePct: number, tenureYears: number, start: string) {
    this.loan = { principal, annualRatePct, tenureYears };
    this.reportStart = start;
    await this.report.generate(this.loan, start);
  },
);

When('I open the amortization report from the dashboard', async function (this: TestWorld) {
  await this.dashboard.reportLink.click();
  await expect(this.currentPage).toHaveURL(/\/reports\.html\?/);
});

Then('the report form should be prefilled with {int} rupees at {float}% for {int} years', async function (this: TestWorld, principal: number, rate: number, tenure: number) {
  await expect(this.report.amountInput).toHaveValue(String(principal));
  await expect(this.report.rateInput).toHaveValue(String(rate));
  await expect(this.report.tenureInput).toHaveValue(String(tenure));
});

Then('the report summary should match my independently calculated values', async function (this: TestWorld) {
  const expected = summarise(this.expectedLoan);
  await expect(this.report.output).toBeVisible();
  await expectRupees(this.report.summaryValue('report-emi'), expected.emi, 'Report EMI');
  await expectRupees(this.report.summaryValue('report-total-interest'), expected.totalInterest, 'Report total interest');
  await expectRupees(this.report.summaryValue('report-total-payment'), expected.totalPayment, 'Report total payment');
  await expect(this.report.summaryValue('report-emi-count')).toHaveText(String(expected.instalments));
});

Then('the report should state {int} EMIs closing in {string}', async function (this: TestWorld, count: number, closing: string) {
  const rows = expectedSchedule(this);
  const last = rows[rows.length - 1];
  // Guard the hard-coded example against the oracle so a typo in the feature cannot pass silently.
  expect(rows).toHaveLength(count);
  expect(`${MONTHS[last.month - 1]} ${last.year}`).toBe(closing);

  await expect(this.report.summaryValue('report-emi-count')).toHaveText(String(count));
  await expect(this.report.summaryValue('report-closing-month')).toHaveText(closing);
});

Then('the schedule should have one row per calendar year of the loan', async function (this: TestWorld) {
  const expectedYears = yearlyTotals(expectedSchedule(this)).map((y) => String(y.year));
  await expect(this.report.scheduleTable.locator('tbody').getByRole('rowheader')).toHaveText(expectedYears);
});

Then('every yearly row should match my independently calculated amortization', async function (this: TestWorld) {
  const expected = yearlyTotals(expectedSchedule(this));
  const shown = await this.report.readSchedule();
  expect(shown).toHaveLength(expected.length);

  const evidence: Array<[string, number, number]> = [];
  shown.forEach((row, i) => {
    const year = expected[i];
    expect(row.period).toBe(String(year.year));
    expectAmountClose(row.principal, year.principal, `${year.year} principal`);
    expectAmountClose(row.interest, year.interest, `${year.year} interest`);
    expectAmountClose(row.totalPaid, year.payment, `${year.year} total paid`);
    expectAmountClose(row.balance, year.closingBalance, `${year.year} balance`);
    evidence.push([`${year.year} interest`, Math.round(year.interest), row.interest]);
  });
  this.attach(comparisonTable(evidence), 'text/plain');
});

Then('the balance after the final year should be zero', async function (this: TestWorld) {
  const rows = await this.report.readSchedule();
  expect(rows[rows.length - 1].balance).toBe(0);
});

// ---- Bar chart --------------------------------------------------------------------------------

Then('the yearly bar chart should be visible', async function (this: TestWorld) {
  const { barChart } = this.report;
  await expect(barChart.chart).toBeVisible();
  await expect(barChart.bars.first()).toBeVisible();
  this.attach(await barChart.chart.screenshot(), 'image/png');
});

Then('the bar chart should contain {int} bars', async function (this: TestWorld, count: number) {
  const expectedYears = yearlyTotals(expectedSchedule(this)).length;
  expect(count, 'feature example should agree with the independent schedule').toBe(expectedYears);
  await expect(this.report.barChart.bars).toHaveCount(count);
  this.attach(`Bars counted in chart: ${await this.report.barChart.bars.count()}`, 'text/plain');
});

Then('every bar should show non-zero principal and interest', async function (this: TestWorld) {
  const expected = yearlyTotals(expectedSchedule(this));
  const bars = await this.report.barChart.barData();
  bars.forEach((bar, i) => {
    expect(bar.principal, `${bar.year} principal`).toBeGreaterThan(0);
    expect(bar.interest, `${bar.year} interest`).toBeGreaterThan(0);
    expectAmountClose(bar.principal, expected[i].principal, `${bar.year} bar principal`);
    expectAmountClose(bar.interest, expected[i].interest, `${bar.year} bar interest`);
  });
  for (const bar of await this.report.barChart.bars.all()) {
    const box = await bar.boundingBox();
    expect(box?.height ?? 0, 'each bar should be painted with a non-zero height').toBeGreaterThan(0);
  }
});

When('I hover over the bar for {int}', async function (this: TestWorld, year: number) {
  await this.report.barChart.hoverBar(year);
});

Then('the tooltip should show the {int} figures from my independently calculated amortization', async function (this: TestWorld, year: number) {
  const { barChart } = this.report;
  await expect(barChart.tooltip).toBeVisible();
  await expect(barChart.tooltip.getByTestId('tooltip-year')).toHaveText(String(year));

  const expected = yearlyTotals(expectedSchedule(this)).find((y) => y.year === year);
  if (!expected) throw new Error(`Year ${year} is outside the loan term`);
  const tooltip = await barChart.readTooltip();

  expectAmountClose(tooltip.principal, expected.principal, 'Tooltip principal');
  expectAmountClose(tooltip.interest, expected.interest, 'Tooltip interest');
  expectAmountClose(tooltip.total, expected.payment, 'Tooltip total paid');
  expectAmountClose(tooltip.balance, expected.closingBalance, 'Tooltip balance');
  this.attach(
    comparisonTable([
      ['Principal', Math.round(expected.principal), tooltip.principal],
      ['Interest', Math.round(expected.interest), tooltip.interest],
      ['Total paid', Math.round(expected.payment), tooltip.total],
      ['Balance', Math.round(expected.closingBalance), tooltip.balance],
    ]),
    'text/plain',
  );
  this.attach(await this.currentPage.screenshot(), 'image/png');
});

// ---- Schedule filter --------------------------------------------------------------------------

When('I filter the schedule to show monthly instalments for {int}', async function (this: TestWorld, year: number) {
  await this.report.showMonthlyScheduleFor(year);
});

Then('the schedule should list {int} monthly instalments for {int}', async function (this: TestWorld, count: number, year: number) {
  const expectedMonths = expectedSchedule(this).filter((r) => r.year === year).map((r) => `${MONTHS[r.month - 1]} ${year}`);
  expect(expectedMonths).toHaveLength(count);
  await expect(this.report.scheduleTable.getByRole('columnheader').first()).toHaveText('Month');
  await expect(this.report.scheduleTable.locator('tbody').getByRole('rowheader')).toHaveText(expectedMonths);
});

Then('every monthly row should match my independently calculated instalments', async function (this: TestWorld) {
  const shown = await this.report.readSchedule();
  const shownYear = Number(shown[0].period.split(' ')[1]);
  const expected = expectedSchedule(this).filter((r) => r.year === shownYear);
  shown.forEach((row, i) => {
    expectAmountClose(row.principal, expected[i].principal, `${row.period} principal`);
    expectAmountClose(row.interest, expected[i].interest, `${row.period} interest`);
    expectAmountClose(row.totalPaid, expected[i].payment, `${row.period} payment`);
    expectAmountClose(row.balance, expected[i].balance, `${row.period} balance`);
  });
});

Then('the bar for {int} should be highlighted', async function (this: TestWorld, year: number) {
  await expect(this.report.barChart.bar(year)).toHaveClass(/bar--active/);
});

Then('I should see the report error {string}', async function (this: TestWorld, message: string) {
  await expect(this.report.errorMessage).toHaveText(message);
});
