import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { DonutChart } from './components/DonutChart';
import { parseRupees } from '../utils/currency';
import type { LoanInput } from '../utils/loanCalculator';

export type LoanField = 'Loan amount' | 'Interest rate' | 'Loan tenure';

export interface DisplayedSummary {
  emi: number;
  totalInterest: number;
  totalPayment: number;
}

export class DashboardPage extends BasePage {
  protected readonly path = '/';

  readonly loanTypeTabs: Locator;
  readonly form: Locator;
  readonly calculateButton: Locator;
  readonly validationMessage: Locator;
  readonly summary: Locator;
  readonly emiValue: Locator;
  readonly totalInterestValue: Locator;
  readonly totalPaymentValue: Locator;
  readonly breakdown: DonutChart;
  readonly chartEmptyState: Locator;
  readonly reportLink: Locator;

  constructor(page: Page) {
    super(page);
    this.loanTypeTabs = page.getByRole('tablist', { name: 'Loan type' });
    this.form = page.getByRole('form', { name: 'Loan details' });
    this.calculateButton = this.form.getByRole('button', { name: 'Calculate' });
    this.validationMessage = this.form.getByRole('alert');
    this.summary = page.getByRole('region', { name: 'Summary' });
    this.emiValue = this.summary.getByTestId('emi-value');
    this.totalInterestValue = this.summary.getByTestId('total-interest-value');
    this.totalPaymentValue = this.summary.getByTestId('total-payment-value');
    const breakdownRegion = page.getByRole('region', { name: 'Payment breakdown' });
    this.breakdown = new DonutChart(breakdownRegion);
    this.chartEmptyState = breakdownRegion.getByTestId('chart-empty');
    this.reportLink = breakdownRegion.getByRole('link', { name: 'View amortization report' });
  }

  tab(name: string): Locator {
    return this.loanTypeTabs.getByRole('tab', { name, exact: true });
  }

  /** Typed input (role "spinbutton"), as opposed to the paired range slider. */
  input(field: LoanField): Locator {
    return this.form.getByRole('spinbutton', { name: field });
  }

  slider(field: LoanField): Locator {
    return this.form.getByRole('slider', { name: `${field} slider` });
  }

  async selectLoanType(name: string): Promise<void> {
    await this.tab(name).click();
  }

  async calculate(loan: LoanInput): Promise<void> {
    await this.input('Loan amount').fill(String(loan.principal));
    await this.input('Interest rate').fill(String(loan.annualRatePct));
    await this.input('Loan tenure').fill(String(loan.tenureYears));
    await this.calculateButton.click();
  }

  async setSlider(field: LoanField, value: number): Promise<void> {
    await this.slider(field).fill(String(value));
  }

  async currentInputs(): Promise<LoanInput> {
    return {
      principal: Number(await this.input('Loan amount').inputValue()),
      annualRatePct: Number(await this.input('Interest rate').inputValue()),
      tenureYears: Number(await this.input('Loan tenure').inputValue()),
    };
  }

  async readSummary(): Promise<DisplayedSummary> {
    return {
      emi: parseRupees(await this.emiValue.textContent()),
      totalInterest: parseRupees(await this.totalInterestValue.textContent()),
      totalPayment: parseRupees(await this.totalPaymentValue.textContent()),
    };
  }
}
