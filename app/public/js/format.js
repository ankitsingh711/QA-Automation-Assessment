(function (root) {
  'use strict';

  const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  root.Format = {
    currency: (value) => inr.format(Math.round(value)),
    percent: (value) => `${value.toFixed(1)}%`,
    monthYear: (year, monthIndex) => `${MONTHS[monthIndex]} ${year}`,
    MONTHS,
  };
})(window);
