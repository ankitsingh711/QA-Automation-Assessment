(function () {
  'use strict';

  const LOAN_TYPES = {
    home: {
      amount: { min: 100000, max: 20000000, step: 100000, initial: 2500000 },
      rate: { min: 5, max: 20, step: 0.05, initial: 10 },
      tenure: { min: 1, max: 30, step: 1, initial: 10 },
    },
    personal: {
      amount: { min: 50000, max: 3000000, step: 10000, initial: 500000 },
      rate: { min: 8, max: 30, step: 0.05, initial: 12 },
      tenure: { min: 1, max: 7, step: 1, initial: 3 },
    },
    car: {
      amount: { min: 100000, max: 5000000, step: 10000, initial: 800000 },
      rate: { min: 6, max: 20, step: 0.05, initial: 9 },
      tenure: { min: 1, max: 8, step: 1, initial: 5 },
    },
  };

  const FIELD_NAMES = { amount: 'Loan amount', rate: 'Interest rate', tenure: 'Loan tenure' };
  const FIELDS = Object.keys(FIELD_NAMES);

  const form = document.getElementById('loan-form');
  const panel = document.getElementById('loan-panel');
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const errorBox = document.getElementById('form-error');
  const chart = document.getElementById('breakdown-chart');
  const emptyState = document.querySelector('[data-testid="chart-empty"]');
  const reportLink = document.getElementById('report-link');
  const out = (id) => document.querySelector(`[data-testid="${id}"]`);

  let activeType = 'home';

  function formatBound(field, value) {
    if (field === 'amount') return Format.currency(value);
    if (field === 'rate') return `${value}%`;
    return `${value} ${value === 1 ? 'year' : 'years'}`;
  }

  function applyLoanType(type) {
    activeType = type;
    const config = LOAN_TYPES[type];
    for (const field of FIELDS) {
      const { min, max, step, initial } = config[field];
      const number = document.getElementById(field);
      const range = document.getElementById(`${field}-range`);
      Object.assign(number, { min, max, step: field === 'rate' ? 0.01 : 1, value: initial });
      Object.assign(range, { min, max, step, value: initial });
      document.getElementById(`${field}-hint`).textContent = `${formatBound(field, min)} – ${formatBound(field, max)}`;
    }
    tabs.forEach((tab) => {
      const selected = tab.dataset.loanType === type;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) panel.setAttribute('aria-labelledby', tab.id);
    });
    recalculate();
  }

  function readValues() {
    const config = LOAN_TYPES[activeType];
    const values = {};
    const errors = [];
    for (const field of FIELDS) {
      const input = document.getElementById(field);
      const raw = input.value.trim();
      const value = Number(raw);
      const { min, max } = config[field];
      let message = null;
      if (raw === '' || Number.isNaN(value)) message = `${FIELD_NAMES[field]} is required.`;
      else if (value < min || value > max) {
        message = `${FIELD_NAMES[field]} must be between ${formatBound(field, min)} and ${formatBound(field, max)}.`;
      } else if (field === 'tenure' && !Number.isInteger(value)) message = 'Loan tenure must be a whole number of years.';
      input.setAttribute('aria-invalid', String(Boolean(message)));
      if (message) errors.push(message);
      values[field] = value;
    }
    return { values, errors };
  }

  function showEmpty() {
    for (const id of ['emi-value', 'total-interest-value', 'total-payment-value', 'legend-principal-value', 'legend-interest-value']) {
      out(id).textContent = '—';
    }
    out('legend-principal-share').textContent = '';
    out('legend-interest-share').textContent = '';
    Charts.clear(chart);
    chart.toggleAttribute('hidden', true); // SVG elements have no .hidden property
    emptyState.hidden = false;
  }

  function recalculate() {
    const { values, errors } = readValues();
    errorBox.textContent = errors.join(' ');
    if (errors.length) {
      showEmpty();
      return;
    }

    const result = LoanMath.summarise(values.amount, values.rate, values.tenure);
    out('emi-value').textContent = Format.currency(result.emi);
    out('total-interest-value').textContent = Format.currency(result.totalInterest);
    out('total-payment-value').textContent = Format.currency(result.totalPayment);

    const principalShare = (values.amount / result.totalPayment) * 100;
    out('legend-principal-value').textContent = Format.currency(values.amount);
    out('legend-interest-value').textContent = Format.currency(result.totalInterest);
    out('legend-principal-share').textContent = `(${Format.percent(principalShare)})`;
    out('legend-interest-share').textContent = `(${Format.percent(100 - principalShare)})`;

    Charts.renderDonut(chart, [
      { key: 'principal', label: 'Principal amount', value: values.amount },
      { key: 'interest', label: 'Total interest', value: result.totalInterest },
    ]);
    chart.toggleAttribute('hidden', false);
    emptyState.hidden = true;

    const params = new URLSearchParams({ amount: values.amount, rate: values.rate, tenure: values.tenure });
    reportLink.href = `/reports.html?${params}`;
  }

  // Sliders update live; typed values are applied on change / Enter / Calculate.
  for (const field of FIELDS) {
    const number = document.getElementById(field);
    const range = document.getElementById(`${field}-range`);
    range.addEventListener('input', () => {
      number.value = range.value;
      recalculate();
    });
    number.addEventListener('change', () => {
      if (number.value !== '') range.value = number.value;
      recalculate();
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    recalculate();
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => applyLoanType(tab.dataset.loanType));
    tab.addEventListener('keydown', (event) => {
      const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!delta) return;
      const next = tabs[(index + delta + tabs.length) % tabs.length];
      next.focus();
      applyLoanType(next.dataset.loanType);
    });
  });

  applyLoanType(activeType);
})();
