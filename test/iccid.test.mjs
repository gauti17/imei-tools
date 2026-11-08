import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeIccid, generateIccid, ICCID_COUNTRIES, isValidIccid } from "../dist/esm/index.js";

test("isValidIccid", () => {
  assert.equal(isValidIccid("8901260000000000006"), true);
  assert.equal(isValidIccid("8901 2600 0000 0000 006"), true);
  assert.equal(isValidIccid("8901260000000000001"), false); // checksum
  assert.equal(isValidIccid("7901260000000000006"), false); // prefix
  assert.equal(isValidIccid("89012600"), false); // length
});

test("analyzeIccid", () => {
  assert.deepEqual(analyzeIccid("8901260000000000006"), {
    digits: "8901260000000000006",
    valid: true,
    industry: "89",
    checkDigit: 6,
    expectedCheckDigit: 6,
    country: "01",
    countryName: "USA / Canada",
  });
  assert.equal(analyzeIccid("8901260000000000001").reason, "checksum");
  assert.equal(analyzeIccid("7901260000000000006").reason, "prefix");
  assert.equal(analyzeIccid("123").reason, "length");
  assert.equal(analyzeIccid("8923400000000000000").country, "234"); // longest code wins
});

test("generateIccid", () => {
  for (let i = 0; i < 200; i++) {
    const iccid = generateIccid();
    assert.match(iccid, /^8901\d{15}$/);
    assert.ok(isValidIccid(iccid), iccid);
  }
  for (const { code } of ICCID_COUNTRIES) {
    const iccid = generateIccid({ country: code, length: 20 });
    assert.equal(iccid.length, 20);
    assert.ok(iccid.startsWith("89" + code));
    assert.ok(isValidIccid(iccid));
    assert.equal(analyzeIccid(iccid).country, code);
  }
  assert.throws(() => generateIccid({ length: 21 }), RangeError);
  assert.throws(() => generateIccid({ country: "1234" }), RangeError);
});
