const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

/** Format an amount as VND, e.g. 189000 → "189.000 ₫". */
export function formatVnd(amount: number): string {
  return vndFormatter.format(amount);
}
