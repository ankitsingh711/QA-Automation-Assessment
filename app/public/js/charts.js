/**
 * Tiny SVG chart helpers (no chart library) so every rendered mark is a real,
 * addressable DOM node with its value exposed via data-* and ARIA attributes.
 */
(function (root) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** Clears the chart but keeps its accessible <title>. */
  function clear(svg) {
    const title = svg.querySelector(':scope > title');
    svg.replaceChildren(...(title ? [title] : []));
  }

  function el(name, attrs = {}, parent) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (parent) parent.appendChild(node);
    return node;
  }

  /**
   * Donut chart. slices: [{ key, label, value, colorVar }]
   */
  function renderDonut(svg, slices) {
    clear(svg);
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    let offset = 0;

    el('circle', { cx: 100, cy: 100, r: radius, class: 'donut-track' }, svg);
    for (const slice of slices) {
      const share = total > 0 ? slice.value / total : 0;
      const length = share * circumference;
      el(
        'circle',
        {
          cx: 100,
          cy: 100,
          r: radius,
          class: `donut-slice donut-slice--${slice.key}`,
          'data-testid': `pie-slice-${slice.key}`,
          'data-value': Math.round(slice.value),
          'data-share': (share * 100).toFixed(2),
          'stroke-dasharray': `${length} ${circumference - length}`,
          'stroke-dashoffset': -offset,
          transform: 'rotate(-90 100 100)',
        },
        svg,
      ).appendChild(document.createElementNS(SVG_NS, 'title')).textContent =
        `${slice.label}: ${root.Format.currency(slice.value)} (${root.Format.percent(share * 100)})`;
      offset += length;
    }
  }

  function niceCeiling(value) {
    if (value <= 0) return 1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= value);
    return step * magnitude;
  }

  function compactInr(value) {
    if (value >= 1e7) return `₹${Number((value / 1e7).toFixed(2))}Cr`;
    if (value >= 1e5) return `₹${Number((value / 1e5).toFixed(2))}L`;
    if (value >= 1e3) return `₹${(value / 1e3).toFixed(0)}K`;
    return `₹${Math.round(value)}`;
  }

  /**
   * Stacked bar chart of yearly principal vs interest.
   * years: output of LoanMath.groupByYear. onActivate(yearData, barElement) / onDeactivate() drive the tooltip.
   */
  function renderYearlyBars(svg, years, { onActivate, onDeactivate, highlightYear } = {}) {
    clear(svg);
    const width = 720;
    const height = 320;
    const pad = { top: 16, right: 16, bottom: 36, left: 64 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const maxValue = niceCeiling(Math.max(...years.map((y) => y.payment)));
    const yScale = (v) => pad.top + plotH - (v / maxValue) * plotH;

    const axis = el('g', { class: 'chart-axis', 'aria-hidden': 'true' }, svg);
    for (let i = 0; i <= 4; i++) {
      const value = (maxValue / 4) * i;
      const y = yScale(value);
      el('line', { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: 'gridline' }, axis);
      el('text', { x: pad.left - 8, y: y + 4, 'text-anchor': 'end' }, axis).textContent = compactInr(value);
    }

    const slot = plotW / years.length;
    const barWidth = Math.min(slot * 0.62, 48);
    const labelEvery = Math.ceil(years.length / 12);
    const bars = el('g', { role: 'list', 'aria-label': 'Yearly principal and interest' }, svg);

    years.forEach((year, index) => {
      const x = pad.left + slot * index + (slot - barWidth) / 2;
      const principalTop = yScale(year.principal);
      const totalTop = yScale(year.payment);
      const group = el(
        'g',
        {
          class: `bar${highlightYear === year.year ? ' bar--active' : ''}`,
          role: 'listitem',
          tabindex: 0,
          'data-testid': 'year-bar',
          'data-year': year.year,
          'data-principal': Math.round(year.principal),
          'data-interest': Math.round(year.interest),
          'aria-label': `${year.year}: principal ${root.Format.currency(year.principal)}, interest ${root.Format.currency(year.interest)}`,
        },
        bars,
      );
      // Transparent hit area so hovering anywhere in the column shows the tooltip.
      el('rect', { x: pad.left + slot * index, y: pad.top, width: slot, height: plotH, class: 'bar-hit' }, group);
      el('rect', { x, y: principalTop, width: barWidth, height: pad.top + plotH - principalTop, class: 'bar-principal' }, group);
      el('rect', { x, y: totalTop, width: barWidth, height: principalTop - totalTop, class: 'bar-interest' }, group);

      if (index % labelEvery === 0) {
        el('text', { x: x + barWidth / 2, y: height - 12, 'text-anchor': 'middle', class: 'chart-axis', 'aria-hidden': 'true' }, svg)
          .textContent = String(year.year);
      }

      const activate = () => onActivate && onActivate(year, group);
      group.addEventListener('mouseenter', activate);
      group.addEventListener('focus', activate);
      group.addEventListener('mouseleave', () => onDeactivate && onDeactivate());
      group.addEventListener('blur', () => onDeactivate && onDeactivate());
    });
  }

  root.Charts = { clear, renderDonut, renderYearlyBars };
})(window);
