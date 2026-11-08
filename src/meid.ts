import { sha1Hex } from "./sha1.js";

// MEID (Mobile Equipment Identifier, CDMA): 56 bits, written as 14 hex digits
// (8-digit manufacturer code + 6-digit serial) or 18 decimal digits (10 + 8).

function cleanMeid(input: string): string {
  return String(input ?? "").replace(/[\s-]/g, "").toUpperCase();
}

/** Normalizes a hex MEID (14 hex digits, optionally followed by its check digit) to 14 uppercase hex digits. */
function hexPart(input: string): string | null {
  const c = cleanMeid(input);
  return /^[0-9A-F]{14,15}$/.test(c) ? c.slice(0, 14) : null;
}

/**
 * 14-digit hex MEID -> 18-digit decimal MEID.
 * Accepts an optional 15th check-digit character, spaces and dashes. Returns null for anything else.
 *
 * @example meidHexToDec("AF0123450ABCDE") // "293608736500703710"
 */
export function meidHexToDec(hex: string): string | null {
  const h = hexPart(hex);
  if (!h) return null;
  return (
    BigInt("0x" + h.slice(0, 8)).toString().padStart(10, "0") +
    BigInt("0x" + h.slice(8)).toString().padStart(8, "0")
  );
}

/**
 * 18-digit decimal MEID -> 14-digit uppercase hex MEID.
 * Returns null if it is not 18 digits or a part is out of range.
 *
 * @example meidDecToHex("293608736500703710") // "AF0123450ABCDE"
 */
export function meidDecToHex(dec: string): string | null {
  const c = cleanMeid(dec);
  if (!/^\d{18}$/.test(c)) return null;
  const mfr = BigInt(c.slice(0, 10)).toString(16).toUpperCase().padStart(8, "0");
  const serial = BigInt(c.slice(10)).toString(16).toUpperCase().padStart(6, "0");
  if (mfr.length > 8 || serial.length > 6) return null;
  return mfr + serial;
}

/** Hex MEID, or decimal MEID converted to hex. */
function toHex(meid: string): string | null {
  return hexPart(meid) ?? meidDecToHex(meid);
}

/**
 * MEID check digit: Luhn in base 16 over the 14 hex digits (uppercase hex character).
 * Accepts hex or decimal MEIDs. Returns null for invalid input.
 *
 * @example meidCheckDigit("AF0123450ABCDE") // "C"
 */
export function meidCheckDigit(meid: string): string | null {
  const hex = toHex(meid);
  if (!hex) return null;
  let sum = 0;
  for (let i = hex.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = parseInt(hex[i], 16);
    if (double) {
      d *= 2;
      d = Math.floor(d / 16) + (d % 16);
    }
    sum += d;
  }
  return ((16 - (sum % 16)) % 16).toString(16).toUpperCase();
}

export type Pesn = {
  /** 8 hex digits, always starting with "80". */
  hex: string;
  /** 11 decimal digits: 3-digit manufacturer code (always "128") + 8-digit serial. */
  dec: string;
};

/**
 * Pseudo-ESN from a MEID: 0x80 followed by the last 24 bits of SHA-1 over the
 * 7 MEID bytes. Accepts hex or decimal MEIDs. Synchronous: SHA-1 is computed by
 * a tiny inline implementation, not Web Crypto. Returns null for invalid input.
 *
 * @example pesnFromMeid("AF0123450ABCDE") // { hex: "8016B128", dec: "12801487144" }
 */
export function pesnFromMeid(meid: string): Pesn | null {
  const hex = toHex(meid);
  if (!hex) return null;
  const bytes = new Uint8Array(7);
  for (let i = 0; i < 7; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  const pesnHex = ("80" + sha1Hex(bytes).slice(-6)).toUpperCase();
  const pesnDec =
    String(parseInt(pesnHex.slice(0, 2), 16)).padStart(3, "0") +
    String(parseInt(pesnHex.slice(2), 16)).padStart(8, "0");
  return { hex: pesnHex, dec: pesnDec };
}

export type MeidConversion = {
  /** 14 uppercase hex digits. */
  hex: string;
  /** 18 decimal digits. */
  dec: string;
  pesnHex: string;
  pesnDec: string;
  /** Base-16 Luhn check digit. */
  checkDigit: string;
};

/** All MEID formats at once from a hex or decimal MEID (same output as the imeilens.com MEID converter). */
export function convertMeid(meid: string): MeidConversion | null {
  const hex = toHex(meid);
  if (!hex) return null;
  const pesn = pesnFromMeid(hex)!;
  return { hex, dec: meidHexToDec(hex)!, pesnHex: pesn.hex, pesnDec: pesn.dec, checkDigit: meidCheckDigit(hex)! };
}
