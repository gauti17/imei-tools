import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { convertMeid, meidCheckDigit, meidDecToHex, meidHexToDec, pesnFromMeid } from "../dist/esm/index.js";
import { sha1Hex } from "../dist/esm/sha1.js";

// Example from the MEID article on Wikipedia: AF 01 23 45 0A BC DE.
test("MEID hex <-> dec", () => {
  assert.equal(meidHexToDec("AF0123450ABCDE"), "293608736500703710");
  assert.equal(meidHexToDec("af01 2345 0abc de"), "293608736500703710");
  assert.equal(meidHexToDec("AF0123450ABCDEC"), "293608736500703710"); // with check digit
  assert.equal(meidDecToHex("293608736500703710"), "AF0123450ABCDE");
  assert.equal(meidHexToDec("A0000012345678"), "268435457803430008");
  assert.equal(meidDecToHex("268435457803430008"), "A0000012345678");
  assert.equal(meidDecToHex("270113177609606313"), "A10000009294A9");
});

test("MEID invalid input", () => {
  assert.equal(meidHexToDec("XYZ"), null);
  assert.equal(meidHexToDec("A00000123456"), null);
  assert.equal(meidDecToHex("12345"), null);
  assert.equal(meidDecToHex("999999999900000000"), null); // manufacturer code > 0xFFFFFFFF
  assert.equal(meidDecToHex("000000000099999999"), null); // serial > 0xFFFFFF
  assert.equal(pesnFromMeid("nope"), null);
  assert.equal(convertMeid(""), null);
});

test("pESN from MEID", () => {
  assert.deepEqual(pesnFromMeid("AF0123450ABCDE"), { hex: "8016B128", dec: "12801487144" });
  assert.deepEqual(pesnFromMeid("293608736500703710"), { hex: "8016B128", dec: "12801487144" });
  assert.deepEqual(pesnFromMeid("A0000012345678"), { hex: "80CAA511", dec: "12813280529" });
  assert.deepEqual(pesnFromMeid("A10000009296F2"), { hex: "8075B7ED", dec: "12807714797" });
});

test("MEID check digit", () => {
  assert.equal(meidCheckDigit("AF0123450ABCDE"), "C");
  assert.equal(meidCheckDigit("A0000012345678"), "D");
  assert.equal(meidCheckDigit("A10000009296F2"), "F");
  assert.equal(meidCheckDigit("bad"), null);
});

test("convertMeid returns every format", () => {
  assert.deepEqual(convertMeid("270113177609606313"), {
    hex: "A10000009294A9",
    dec: "270113177609606313",
    pesnHex: "806A69FA",
    pesnDec: "12806973946",
    checkDigit: "9",
  });
});

test("inline SHA-1 matches node:crypto", () => {
  assert.equal(sha1Hex(new Uint8Array()), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
  assert.equal(sha1Hex(new TextEncoder().encode("abc")), "a9993e364706816aba3e25717850c26c9cd0d89d");
  for (let len = 0; len < 200; len++) {
    const buf = randomBytes(len);
    assert.equal(sha1Hex(new Uint8Array(buf)), createHash("sha1").update(buf).digest("hex"), `length ${len}`);
  }
});
