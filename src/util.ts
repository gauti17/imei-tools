/** Strips everything except ASCII digits. */
export function onlyDigits(input: string): string {
  return String(input ?? "").replace(/\D/g, "");
}

/**
 * Luhn (mod 10) check digit for a numeric string: pass the digits that come
 * *before* the check digit. Used by IMEIs, ICCIDs and payment cards.
 *
 * @example luhnCheckDigit("35002098123456") // 4
 */
export function luhnCheckDigit(body: string): number {
  if (!/^\d*$/.test(body)) throw new TypeError("luhnCheckDigit expects a string of digits");
  let sum = 0;
  // Walk from the right; the digit next to the (future) check digit is doubled.
  for (let i = body.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = body.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** Returns a uniformly distributed integer in [0, 1). Must behave like Math.random. */
export type RandomSource = () => number;

type CryptoLike = { getRandomValues<T extends ArrayBufferView>(array: T): T };

/**
 * Random decimal digits. Uses Web Crypto `getRandomValues` (all browsers, Node 19+,
 * Deno, Bun, edge runtimes) with rejection sampling so every digit is equally likely.
 * Falls back to Math.random where Web Crypto is missing (Node 18 without the global).
 * A custom `random` source overrides both (useful for seeded tests).
 */
export function randomDigits(n: number, random?: RandomSource): string {
  let out = "";
  if (random) {
    while (out.length < n) out += String(Math.floor(random() * 10) % 10);
    return out;
  }
  const c = (globalThis as { crypto?: CryptoLike }).crypto;
  if (!c?.getRandomValues) {
    while (out.length < n) out += String(Math.floor(Math.random() * 10) % 10);
    return out;
  }
  const bytes = new Uint8Array(Math.max(16, n * 2));
  while (out.length < n) {
    c.getRandomValues(bytes);
    for (let i = 0; i < bytes.length && out.length < n; i++) {
      if (bytes[i] < 250) out += String(bytes[i] % 10); // 250 = 25 * 10, drop the biased tail
    }
  }
  return out;
}
