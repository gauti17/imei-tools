const { test } = require("node:test");
const assert = require("node:assert/strict");
const lib = require("imei-tools");

test("CommonJS build works through the package exports", () => {
  assert.equal(lib.isValidImei("350020981234564"), true);
  assert.deepEqual(lib.pesnFromMeid("AF0123450ABCDE"), { hex: "8016B128", dec: "12801487144" });
  assert.ok(lib.isValidIccid(lib.generateIccid()));
  assert.equal(typeof lib.ImeiLensClient, "function");
});

test("ESM and CJS builds export the same names", async () => {
  const esm = await import("imei-tools");
  assert.deepEqual(Object.keys(esm).filter((k) => k !== "default").sort(), Object.keys(lib).filter((k) => k !== "__esModule").sort());
});
