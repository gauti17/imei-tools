import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyzeImei,
  generateImei,
  imeisvToImei,
  imeiToImeisv,
  isValidImei,
  luhnCheckDigit,
  onlyDigits,
} from "../dist/esm/index.js";

test("luhnCheckDigit: known vectors", () => {
  assert.equal(luhnCheckDigit("35002098123456"), 4);
  assert.equal(luhnCheckDigit("49015420323751"), 8);
  assert.equal(luhnCheckDigit("7992739871"), 3); // classic Luhn example
  assert.equal(luhnCheckDigit(""), 0);
  assert.throws(() => luhnCheckDigit("12a4"), TypeError);
});

test("isValidImei: valid and invalid numbers", () => {
  assert.equal(isValidImei("350020981234564"), true);
  assert.equal(isValidImei("490154203237518"), true);
  assert.equal(isValidImei("35-002098-123456-4"), true);
  assert.equal(isValidImei(" 35 002098 123456 4 "), true);
  assert.equal(isValidImei("350020981234565"), false); // wrong check digit
  assert.equal(isValidImei("35002098123456"), false); // 14 digits
  assert.equal(isValidImei("35002098123456a"), false);
  assert.equal(isValidImei("4901542032375109"), false); // IMEISV is not an IMEI
  assert.equal(isValidImei(""), false);
});

test("analyzeImei: splits a valid IMEI", () => {
  assert.deepEqual(analyzeImei("350020981234564"), {
    input: "350020981234564",
    digits: "350020981234564",
    valid: true,
    tac: "35002098",
    reportingBody: "35",
    serial: "123456",
    checkDigit: 4,
    expectedCheckDigit: 4,
  });
});

test("analyzeImei: reasons", () => {
  const bad = analyzeImei("350020981234560");
  assert.equal(bad.valid, false);
  assert.equal(bad.reason, "checksum");
  assert.equal(bad.checkDigit, 0);
  assert.equal(bad.expectedCheckDigit, 4);
  assert.equal(analyzeImei("12345").reason, "length");
  assert.equal(analyzeImei("35002098123456x").reason, "chars");
});

test("analyzeImei: IMEISV", () => {
  assert.deepEqual(analyzeImei("4901542032375109"), {
    input: "4901542032375109",
    digits: "4901542032375109",
    valid: true,
    isImeisv: true,
    tac: "49015420",
    reportingBody: "49",
    serial: "323751",
    svn: "09",
  });
});

test("imeiToImeisv / imeisvToImei round trip", () => {
  assert.equal(imeiToImeisv("490154203237518", "09"), "4901542032375109");
  assert.equal(imeiToImeisv("490154203237518", 9), "4901542032375109");
  assert.equal(imeiToImeisv("490154203237519", "09"), null);
  assert.deepEqual(imeisvToImei("4901542032375109"), { imei: "490154203237518", svn: "09" });
  assert.deepEqual(imeisvToImei("3500209812345601"), { imei: "350020981234564", svn: "01" });
  assert.equal(imeisvToImei("490154203237518"), null);
});

test("generateImei: defaults to one test IMEI with the 00 reporting body", () => {
  const out = generateImei();
  assert.equal(out.length, 1);
  assert.match(out[0], /^00\d{13}$/);
  assert.ok(isValidImei(out[0]));
});

test("generateImei: count, uniqueness and validity", () => {
  const out = generateImei({ count: 500 });
  assert.equal(out.length, 500);
  assert.equal(new Set(out).size, 500);
  for (const imei of out) assert.ok(isValidImei(imei), imei);
});

test("generateImei: tac and prefix", () => {
  for (const imei of generateImei({ tac: "35002098", count: 20 })) {
    assert.ok(imei.startsWith("35002098"));
    assert.ok(isValidImei(imei));
  }
  for (const imei of generateImei({ prefix: "0112", count: 5 })) assert.ok(imei.startsWith("0112"));
  assert.equal(generateImei({ prefix: "35002098123456" })[0], "350020981234564");
  assert.throws(() => generateImei({ tac: "123" }), RangeError);
  assert.throws(() => generateImei({ prefix: "123456789012345" }), RangeError);
});

test("generateImei: count is clamped and limited by the number space", () => {
  assert.equal(generateImei({ count: 0 }).length, 1);
  assert.equal(generateImei({ count: 5000 }).length, 1000);
  // Only 10 possible values with a 13-digit prefix.
  assert.equal(generateImei({ prefix: "0012345678901", count: 50 }).length, 10);
});

test("generateImei: custom random source is used", () => {
  const imei = generateImei({ random: () => 0 })[0];
  assert.equal(imei, "000000000000000");
});

test("onlyDigits", () => {
  assert.equal(onlyDigits("35-0020 98/1234.564"), "350020981234564");
});
