/**
 * Independent oracle for loan figures.
 *
 * Written separately from the app's app/public/js/loan-math.js on purpose — the
 * tests must never derive their expected values from the code under test.
 *
 *   EMI = P · r · (1 + r)^n / ((1 + r)^n − 1)
 *   P = principal, r = monthly rate (annual % / 12 / 100), n = number of monthly instalments
 */

export interface LoanInput {
  principal: number;
  annualRatePct: number;
  tenureYears: number;
}

export interface LoanSummary {
  instalments: number;
  emi: number;
  totalPayment: number;
  totalInterest: number;
}

export interface Instalment {
  year: number;
  /** 1-12 */
  month: number;
  principal: number;
  interest: number;
  payment: number;
  balance: number;
}

export interface YearTotals {
  year: number;
  principal: number;
  interest: number;
  payment: number;
  closingBalance: number;
  instalments: number;
}

export function exactEmi({ principal, annualRatePct, tenureYears }: LoanInput): number {
  const n = tenureYears * 12;
  const r = annualRatePct / 1200;
  if (r === 0) return principal / n;
  const compound = (1 + r) ** n;
  return (principal * r * compound) / (compound - 1);
}

/** Business rule: EMI displayed to the nearest rupee, totals from the unrounded EMI. */
export function summarise(loan: LoanInput): LoanSummary {
  const instalments = loan.tenureYears * 12;
  const emi = exactEmi(loan);
  const totalPayment = Math.round(emi * instalments);
  return {
    instalments,
    emi: Math.round(emi),
    totalPayment,
    totalInterest: totalPayment - loan.principal,
  };
}

/** @param start "YYYY-MM" of the first instalment */
export function schedule(loan: LoanInput, start: string): Instalment[] {
  const [startYear, startMonth] = start.split('-').map(Number);
  const emi = exactEmi(loan);
  const r = loan.annualRatePct / 1200;
  const n = loan.tenureYears * 12;
  const rows: Instalment[] = [];
  let balance = loan.principal;

  for (let k = 0; k < n; k++) {
    const interest = balance * r;
    const principal = k === n - 1 ? balance : emi - interest;
    balance -= principal;
    const monthIndex = startMonth - 1 + k;
    rows.push({
      year: startYear + Math.floor(monthIndex / 12),
      month: (monthIndex % 12) + 1,
      principal,
      interest,
      payment: principal + interest,
      balance: Math.abs(balance) < 1e-6 ? 0 : balance,
    });
  }
  return rows;
}

export function yearlyTotals(rows: Instalment[]): YearTotals[] {
  const byYear = new Map<number, YearTotals>();
  for (const row of rows) {
    const totals = byYear.get(row.year) ?? { year: row.year, principal: 0, interest: 0, payment: 0, closingBalance: 0, instalments: 0 };
    totals.principal += row.principal;
    totals.interest += row.interest;
    totals.payment += row.payment;
    totals.closingBalance = row.balance;
    totals.instalments += 1;
    byYear.set(row.year, totals);
  }
  return [...byYear.values()];
}
