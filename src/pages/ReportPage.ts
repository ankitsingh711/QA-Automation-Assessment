import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { YearlyBarChart } from './components/YearlyBarChart';
import { parseRupees } from '../utils/currency';
import type { LoanInput } from '../utils/loanCalculator';

export interface ScheduleRow {
  period: string;
  principal: number;
  interest: number;
  totalPaid: number;
  balance: number;
}

export class ReportPage extends BasePage {
  protected readonly path = '/reports.html';

  readonly form: Locator;
  readonly amountInput: Locator;
  readonly rateInput: Locator;
  readonly tenureInput: Locator;
  readonly startMonthInput: Locator;
  readonly generateButton: Locator;
  readonly errorMessage: Locator;
  readonly output: Locator;
  readonly barChart: YearlyBarChart;
  readonly scheduleView: Locator;
  readonly scheduleTable: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByRole('form', { name: 'Report parameters' });
    this.amountInput = this.form.getByRole('spinbutton', { name: 'Loan amount' });
    this.rateInput = this.form.getByRole('spinbutton', { name: 'Interest rate' });
    this.tenureInput = this.form.getByRole('spinbutton', { name: 'Loan tenure' });
    this.startMonthInput = this.form.getByLabel('First EMI month');
    this.generateButton = this.form.getByRole('button', { name: 'Generate report' });
    this.errorMessage = this.form.getByRole('alert');
    this.output = page.getByRole('region', { name: 'Report summary' });
    this.barChart = new YearlyBarChart(page, page.getByRole('region', { name: 'Yearly repayment split' }));
    this.scheduleView = page.getByRole('combobox', { name: 'Schedule view' });
    this.scheduleTable = page.getByRole('table', { name: 'Repayment schedule' });
  }

  summaryValue(testId: 'report-emi' | 'report-total-interest' | 'report-total-payment' | 'report-emi-count' | 'report-closing-month'): Locator {
    return this.output.getByTestId(testId);
  }

  async generate(loan: LoanInput, startMonth: string): Promise<void> {
    await this.amountInput.fill(String(loan.principal));
    await this.rateInput.fill(String(loan.annualRatePct));
    await this.tenureInput.fill(String(loan.tenureYears));
    await this.startMonthInput.fill(startMonth);
    await this.generateButton.click();
  }

  async showMonthlyScheduleFor(year: number): Promise<void> {
    await this.scheduleView.selectOption({ label: `Monthly – ${year}` });
  }

  async readSchedule(): Promise<ScheduleRow[]> {
    const rows = this.scheduleTable.locator('tbody').getByRole('row');
    const cells = await rows.evaluateAll((trs) => trs.map((tr) => Array.from(tr.children, (c) => c.textContent ?? '')));
    return cells.map(([period, principal, interest, totalPaid, balance]) => ({
      period,
      principal: parseRupees(principal),
      interest: parseRupees(interest),
      totalPaid: parseRupees(totalPaid),
      balance: parseRupees(balance),
    }));
  }
}
