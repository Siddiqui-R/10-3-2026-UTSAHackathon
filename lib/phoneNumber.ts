/** US numbers to 10 digits: "(210) 555-0100", "+1 210 555 0100" → "2105550100". */
export function normalizeUsNumber(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? digits : null;
}
export function formatUsNumber(digits: string) { return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`; }
