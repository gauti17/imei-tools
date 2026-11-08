import { luhnCheckDigit, onlyDigits, randomDigits, type RandomSource } from "./util.js";

export type ImeiAnalysis = {
  /** The input, trimmed. */
  input: string;
  /** Digits only (separators removed). */
  digits: string;
  /** True for a 15-digit IMEI with a correct check digit, or any 16-digit IMEISV. */
  valid: boolean;
  /** Why it is invalid: wrong length, failed Luhn check, or characters other than digits and separators. */
  reason?: "length" | "checksum" | "chars";
  /** Type Allocation Code: first 8 digits, identifies the device model. */
  tac?: string;
  /** Reporting Body Identifier: first 2 digits of the TAC ("00"/"01" are test ranges). */
  reportingBody?: string;
  /** 6-digit serial number (digits 9 to 14). */
  serial?: string;
  /** The check digit found in the input (IMEI only). */
  checkDigit?: number;
  /** The check digit the Luhn algorithm expects (IMEI only). */
  expectedCheckDigit?: number;
  /** True when the input is a 16-digit IMEISV. */
  isImeisv?: boolean;
  /** 2-digit software version number (IMEISV only). */
  svn?: string;
};

/**
 * Validates a 15-digit IMEI (or a 16-digit IMEISV) and splits it into its parts.
 * Spaces, dashes, slashes and dots are accepted as separators.
 */
export function analyzeImei(input: string): ImeiAnalysis {
  const trimmed = String(input ?? "").trim();
  const digits = onlyDigits(trimmed);
  const base: ImeiAnalysis = { input: trimmed, digits, valid: false };

  if (/[^\d\s\-/.]/.test(trimmed)) return { ...base, reason: "chars" };

  if (digits.length === 16) {
    // IMEISV: TAC(8) + serial(6) + software version(2), no check digit.
    return {
      ...base,
      valid: true,
      isImeisv: true,
      tac: digits.slice(0, 8),
      reportingBody: digits.slice(0, 2),
      serial: digits.slice(8, 14),
      svn: digits.slice(14),
    };
  }

  if (digits.length !== 15) return { ...base, reason: "length" };

  const expected = luhnCheckDigit(digits.slice(0, 14));
  const actual = Number(digits[14]);
  const out: ImeiAnalysis = {
    ...base,
    valid: expected === actual,
    tac: digits.slice(0, 8),
    reportingBody: digits.slice(0, 2),
    serial: digits.slice(8, 14),
    checkDigit: actual,
    expectedCheckDigit: expected,
  };
  if (!out.valid) out.reason = "checksum";
  return out;
}

/** True for a 15-digit IMEI whose Luhn check digit is correct. IMEISVs return false. */
export function isValidImei(input: string): boolean {
  const a = analyzeImei(input);
  return a.valid && !a.isImeisv;
}

export type GenerateImeiOptions = {
  /** How many unique IMEIs to return (1 to 1000, default 1). */
  count?: number;
  /** Exact 8-digit Type Allocation Code to use. */
  tac?: string;
  /** Any leading digits (0 to 14). Defaults to "00", the test reporting body. Ignored when `tac` is set. */
  prefix?: string;
  /** Custom random source in [0, 1), e.g. a seeded PRNG for reproducible tests. */
  random?: RandomSource;
};

export const MAX_GENERATE = 1000;

/**
 * Generates unique, Luhn-valid test IMEIs.
 *
 * By default numbers start with "00", the reporting body reserved for test
 * equipment, so they cannot collide with real handsets. For testing only.
 *
 * @throws RangeError if `tac` is not exactly 8 digits or `prefix` is longer than 14 digits.
 */
export function generateImei(options: GenerateImeiOptions = {}): string[] {
  const { tac, prefix, random } = options;
  const n = Math.min(MAX_GENERATE, Math.max(1, Math.floor(Number(options.count ?? 1) || 1)));
  const p = onlyDigits(tac ?? prefix ?? "00");
  if (tac !== undefined && p.length !== 8) throw new RangeError("tac must be exactly 8 digits.");
  if (p.length > 14) throw new RangeError("prefix can be at most 14 digits.");

  const seen = new Set<string>();
  // The number of free serial digits caps how many unique values exist; the guard stops the loop.
  for (let g = 0; seen.size < n && g < n * 20; g++) {
    const body = p + randomDigits(14 - p.length, random);
    seen.add(body + String(luhnCheckDigit(body)));
  }
  return [...seen];
}

/**
 * IMEI (15 digits) + 2-digit software version number -> IMEISV (16 digits).
 * Returns null if the IMEI is not valid.
 *
 * @example imeiToImeisv("490154203237518", "09") // "4901542032375109"
 */
export function imeiToImeisv(imei: string, svn: string | number): string | null {
  const d = onlyDigits(imei);
  const v = onlyDigits(String(svn)).padStart(2, "0").slice(-2);
  if (d.length !== 15 || !isValidImei(d)) return null;
  return d.slice(0, 14) + v;
}

/**
 * IMEISV (16 digits) -> IMEI (15 digits) with a recalculated check digit, plus the SVN.
 * Returns null if the input is not 16 digits.
 */
export function imeisvToImei(imeisv: string): { imei: string; svn: string } | null {
  const d = onlyDigits(imeisv);
  if (d.length !== 16) return null;
  const body = d.slice(0, 14);
  return { imei: body + String(luhnCheckDigit(body)), svn: d.slice(14) };
}
