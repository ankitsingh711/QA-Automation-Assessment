/**
 * Loan maths used by the LoanLens UI.
 *
 * The automation suite deliberately does NOT import this file: tests compute their
 * expected values with their own implementation (src/utils/loanCalculator.ts) so a
 * bug here cannot hide behind a test that shares the same code.
 */
(function (root) {
  'use strict';

  function monthlyEmi(principal, annualRatePct, months) {
    const r = annualRatePct / 12 / 100;
    if (r === 0) return principal / months;
    const growth = Math.pow(1 + r, months);
    return (principal * r * growth) / (growth - 1);
  }

  /**
   * Headline figures. EMI is shown rounded to the nearest rupee; totals are derived
   * from the unrounded EMI and then rounded (same convention as emicalculator.net).
   */
  function summarise(principal, annualRatePct, tenureYears) {
    const months = Math.round(tenureYears * 12);
    const emi = monthlyEmi(principal, annualRatePct, months);
    const totalPayment = Math.round(emi * months);
    return {
      months,
      emi: Math.round(emi),
      totalPayment,
      totalInterest: totalPayment - principal,
      principal,
    };
  }

  /** Month-by-month schedule. startMonthIndex is 0-based (0 = January). */
  function amortise(principal, annualRatePct, tenureYears, startYear, startMonthIndex) {
    const months = Math.round(tenureYears * 12);
    const r = annualRatePct / 12 / 100;
    const emi = monthlyEmi(principal, annualRatePct, months);
    const rows = [];
    let balance = principal;

    for (let i = 0; i < months; i++) {
      const interest = balance * r;
      // Final instalment clears any floating point residue.
      const principalPaid = i === months - 1 ? balance : emi - interest;
      balance = Math.max(balance - principalPaid, 0);
      const date = new Date(startYear, startMonthIndex + i, 1);
      rows.push({
        number: i + 1,
        year: date.getFullYear(),
        month: date.getMonth(),
        principal: principalPaid,
        interest,
        payment: principalPaid + interest,
        balance,
      });
    }
    return rows;
  }

  function groupByYear(rows) {
    const years = [];
    for (const row of rows) {
      let bucket = years[years.length - 1];
      if (!bucket || bucket.year !== row.year) {
        bucket = { year: row.year, principal: 0, interest: 0, payment: 0, balance: 0, payments: 0 };
        years.push(bucket);
      }
      bucket.principal += row.principal;
      bucket.interest += row.interest;
      bucket.payment += row.payment;
      bucket.balance = row.balance;
      bucket.payments += 1;
    }
    return years;
  }

  root.LoanMath = { monthlyEmi, summarise, amortise, groupByYear };
})(typeof window !== 'undefined' ? window : globalThis);
