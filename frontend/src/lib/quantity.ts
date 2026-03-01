export { titleCase as toTitleCase } from "title-case";

const FRACTIONS: Array<[number, string]> = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [1 / 3, "1/3"],
  [3 / 8, "3/8"],
  [1 / 2, "1/2"],
  [5 / 8, "5/8"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
  [7 / 8, "7/8"],
];

export function formatQuantity(qty: number | null | undefined): string {
  if (qty == null) return "";
  const whole = Math.floor(qty);
  const frac = qty - whole;
  const fracStr = FRACTIONS.find(([val]) => Math.abs(frac - val) < 0.02)?.[1] ?? "";
  if (whole === 0) return fracStr || String(qty);
  if (!fracStr) return Math.abs(frac) < 0.02 ? String(whole) : String(qty);
  return `${whole} ${fracStr}`;
}
