(function () {
  'use strict';

  const LIMITS = {
    amount: { label: 'Loan amount', min: 10000, max: 100000000 },
    rate: { label: 'Interest rate', min: 0.1, max: 30 },
    tenure: { label: 'Loan tenure', min: 1, max: 30 },
  };

  const form = document.getElementById('report-form');
  const output = document.getElementById('report-output');
  const errorBox = document.getElementById('report-error');
  const chart = document.getElementById('yearly-chart');
  const tooltip = document.getElementById('bar-tooltip');
  const viewSelect = document.getElementById('schedule-view');
  const tbody = document.querySelector('#schedule-table tbody');
  const periodCol = document.getElementById('period-col');
  const inputs = {
    amount: document.getElementById('report-amount'),
    rate: document.getElementById('report-rate'),
    tenure: document.getElementById('report-tenure'),
    start: document.getElementById('report-start'),
  };
  const out = (id) => document.querySelector(`[data-testid="${id}"]`);

  let schedule = null;

  function currentMonthValue() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function prefillFromQuery() {
    const params = new URLSearchParams(location.search);
    for (const key of ['amount', 'rate', 'tenure', 'start']) {
      if (params.has(key)) inputs[key].value = params.get(key);
    }
    if (!inputs.start.value) inputs.start.value = currentMonthValue();
    return params.has('amount');
  }

  function validate() {
    const errors = [];
    const values = {};
    for (const [key, { label, min, max }] of Object.entries(LIMITS)) {
      const raw = inputs[key].value.trim();
      const value = Number(raw);
      let message = null;
      if (raw === '' || Number.isNaN(value)) message = `${label} is required.`;
      else if (value < min || value > max) message = `${label} must be between ${min.toLocaleString('en-IN')} and ${max.toLocaleString('en-IN')}.`;
      else if (key === 'tenure' && !Number.isInteger(value)) message = 'Loan tenure must be a whole number of years.';
      inputs[key].setAttribute('aria-invalid', String(Boolean(message)));
      if (message) errors.push(message);
      values[key] = value;
    }
    const start = /^(\d{4})-(\d{2})$/.exec(inputs.start.value);
    inputs.start.setAttribute('aria-invalid', String(!start));
    if (!start) errors.push('First EMI month is required.');
    else Object.assign(values, { startYear: Number(start[1]), startMonth: Number(start[2]) - 1 });
    return { values, errors };
  }

  function showTooltip(year, bar) {
    out('tooltip-year').textContent = String(year.year);
    out('tooltip-principal').textContent = Format.currency(year.principal);
    out('tooltip-interest').textContent = Format.currency(year.interest);
    out('tooltip-total').textContent = Format.currency(year.payment);
    out('tooltip-balance').textContent = Format.currency(year.balance);
    tooltip.hidden = false;

    const wrap = tooltip.parentElement.getBoundingClientRect();
    const box = bar.getBoundingClientRect();
    const left = Math.min(Math.max(box.left - wrap.left + box.width / 2 - tooltip.offsetWidth / 2, 0), wrap.width - tooltip.offsetWidth);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(box.top - wrap.top - tooltip.offsetHeight - 8, 0)}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function renderChart(highlightYear) {
    Charts.renderYearlyBars(chart, schedule.years, { onActivate: showTooltip, onDeactivate: hideTooltip, highlightYear });
  }

  function row(cells) {
    const tr = document.createElement('tr');
    cells.forEach((text, i) => {
      const cell = document.createElement(i === 0 ? 'th' : 'td');
      if (i === 0) cell.scope = 'row';
      cell.textContent = text;
      tr.appendChild(cell);
    });
    return tr;
  }

  function renderTable() {
    const view = viewSelect.value;
    tbody.replaceChildren();
    if (view === 'yearly') {
      periodCol.textContent = 'Year';
      for (const y of schedule.years) {
        tbody.appendChild(row([String(y.year), Format.currency(y.principal), Format.currency(y.interest), Format.currency(y.payment), Format.currency(y.balance)]));
      }
    } else {
      periodCol.textContent = 'Month';
      for (const m of schedule.months.filter((r) => r.year === Number(view))) {
        tbody.appendChild(row([Format.monthYear(m.year, m.month), Format.currency(m.principal), Format.currency(m.interest), Format.currency(m.payment), Format.currency(m.balance)]));
      }
    }
    renderChart(view === 'yearly' ? null : Number(view));
  }

  function generate() {
    const { values, errors } = validate();
    errorBox.textContent = errors.join(' ');
    if (errors.length) {
      output.hidden = true;
      return;
    }

    const months = LoanMath.amortise(values.amount, values.rate, values.tenure, values.startYear, values.startMonth);
    const years = LoanMath.groupByYear(months);
    const summary = LoanMath.summarise(values.amount, values.rate, values.tenure);
    schedule = { months, years };

    out('report-emi').textContent = Format.currency(summary.emi);
    out('report-total-interest').textContent = Format.currency(summary.totalInterest);
    out('report-total-payment').textContent = Format.currency(summary.totalPayment);
    out('report-emi-count').textContent = String(summary.months);
    const last = months[months.length - 1];
    out('report-closing-month').textContent = Format.monthYear(last.year, last.month);

    viewSelect.replaceChildren(new Option('Yearly summary', 'yearly'));
    for (const y of years) viewSelect.appendChild(new Option(`Monthly – ${y.year}`, String(y.year)));
    viewSelect.value = 'yearly';

    output.hidden = false;
    hideTooltip();
    renderTable();

    const params = new URLSearchParams({ amount: values.amount, rate: values.rate, tenure: values.tenure, start: inputs.start.value });
    history.replaceState(null, '', `?${params}`);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    generate();
  });
  viewSelect.addEventListener('change', renderTable);

  // Arriving from the dashboard link generates the report straight away.
  if (prefillFromQuery()) generate();
})();
