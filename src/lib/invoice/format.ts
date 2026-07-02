/** Paise → "₹1,234.00" (two decimals, en-IN grouping). */
export function formatPaiseInr(paise: number): string {
  const rupees = (paise ?? 0) / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
