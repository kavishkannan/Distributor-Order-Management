export function formatPrice(Value: number | string): string {
  const Numeric = typeof Value === "string" ? parseFloat(Value) : Value;
  return Numeric.toFixed(2);
}
