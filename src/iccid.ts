import { luhnCheckDigit, onlyDigits, randomDigits, type RandomSource } from "./util.js";

// ICCID: SIM card number (ITU-T E.118). "89" (telecom industry) + country calling
// code + issuer and account digits + Luhn check digit, 18 to 22 digits in total.

/** Country calling codes with a display name, as offered by the imeilens.com ICCID generator. */
export const ICCID_COUNTRIES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "01", name: "USA / Canada" },
  { code: "44", name: "United Kingdom" },
  { code: "49", name: "Germany" },
  { code: "33", name: "France" },
  { code: "34", name: "Spain" },
  { code: "39", name: "Italy" },
  { code: "55", name: "Brazil" },
  { code: "52", name: "Mexico" },
  { code: "90", name: "Türkiye" },
  { code: "62", name: "Indonesia" },
  { code: "91", name: "India" },
  { code: "234", name: "Nigeria" },
];

export type IccidAnalysis = {
  digits: string;
  valid: boolean;
  reason?: "length" | "prefix" | "checksum";
  /** Major industry identifier, always "89". */
  industry?: string;
  /** Country calling code, when it is one of ICCID_COUNTRIES. */
  country?: string;
  countryName?: string;
  checkDigit?: number;
  expectedCheckDigit?: number;
};

/** Validates an ICCID: 18 to 22 digits, starts with 89, correct Luhn check digit. */
export function analyzeIccid(input: string): IccidAnalysis {
  const digits = onlyDigits(input);
  const base: IccidAnalysis = { digits, valid: false };
  if (digits.length < 18 || digits.length > 22) return { ...base, reason: "length" };
  if (!digits.startsWith("89")) return { ...base, reason: "prefix" };
  const expected = luhnCheckDigit(digits.slice(0, -1));
  const actual = Number(digits[digits.length - 1]);
  const country = [...ICCID_COUNTRIES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => digits.slice(2).startsWith(c.code));
  const out: IccidAnalysis = {
    ...base,
    valid: expected === actual,
    industry: "89",
    checkDigit: actual,
    expectedCheckDigit: expected,
  };
  if (!out.valid) out.reason = "checksum";
  if (country) {
    out.country = country.code;
    out.countryName = country.name;
  }
  return out;
}

/** True for an 18 to 22 digit ICCID that starts with 89 and has a correct Luhn check digit. */
export function isValidIccid(input: string): boolean {
  return analyzeIccid(input).valid;
}

export type GenerateIccidOptions = {
  /** Country calling code, 1 to 3 digits (default "01", USA / Canada). See ICCID_COUNTRIES. */
  country?: string;
  /** Total length including the check digit: 19 (default) or 20. */
  length?: 19 | 20;
  /** Custom random source in [0, 1). */
  random?: RandomSource;
};

/**
 * Generates one Luhn-valid test ICCID: 89 + country code + random digits + check digit.
 * For testing only: not assigned to a real SIM card.
 *
 * @throws RangeError for an invalid country code or length.
 */
export function generateIccid(options: GenerateIccidOptions = {}): string {
  const { country = "01", length = 19, random } = options;
  const code = onlyDigits(country);
  if (code.length < 1 || code.length > 3) throw new RangeError("country must be a 1 to 3 digit calling code.");
  if (length !== 19 && length !== 20) throw new RangeError("length must be 19 or 20.");
  const prefix = "89" + code;
  const body = prefix + randomDigits(length - 1 - prefix.length, random);
  return body + String(luhnCheckDigit(body));
}
