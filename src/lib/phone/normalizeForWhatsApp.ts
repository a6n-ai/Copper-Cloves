/** Strip to digits and coerce common India local numbers to E.164 digits (no leading +). WhatsApp Cloud API expects `to` without +. */
export function normalizePhoneDigitsForWhatsApp(
  raw: string | null | undefined,
  defaultCountryCode = "91"
): string | null {
  if (!raw?.trim()) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = d.slice(1);
  const cc = defaultCountryCode.replace(/\D/g, "");
  if (cc && d.length === 10 && !d.startsWith(cc)) {
    d = `${cc}${d}`;
  }
  if (d.length < 11) return null;
  return d;
}
