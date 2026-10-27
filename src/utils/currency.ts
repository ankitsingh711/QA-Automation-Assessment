/** Parses UI currency text such as "₹14,64,522" (Indian digit grouping) into a number. */
export function parseRupees(text: string | null): number {
  const cleaned = (text ?? '').replace(/[₹,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Expected a rupee amount but got "${text}"`);
  }
  return Number(cleaned);
}

/** Rupee figures in the UI are rounded to whole rupees; allow ±1 for rounding of summed values. */
export const RUPEE_TOLERANCE = 1;
