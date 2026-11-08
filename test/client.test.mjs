import { test } from "node:test";
import assert from "node:assert/strict";
import { ImeiLensApiError, ImeiLensClient } from "../dist/esm/index.js";

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const { status = 200, body, headers = {} } = handler(url, init);
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
  };
  fn.calls = calls;
  return fn;
}

test("validate builds the GET request against the default base URL", async () => {
  const fetch = mockFetch(() => ({ body: { imei: "350020981234564", valid: true, device: null } }));
  const client = new ImeiLensClient({ fetch });
  const res = await client.validate("350020981234564");
  assert.equal(res.valid, true);
  assert.equal(fetch.calls[0].url, "https://imeilens.com/api/v1/imei/validate?imei=350020981234564");
  assert.equal(fetch.calls[0].init.method, "GET");
  assert.equal(fetch.calls[0].init.body, undefined);
});

test("validateMany POSTs JSON; base URL is configurable", async () => {
  const fetch = mockFetch(() => ({ body: { count: 2, valid: 1, results: [] } }));
  const client = new ImeiLensClient({ fetch, baseUrl: "http://localhost:3000/", headers: { "X-Test": "1" } });
  await client.validateMany(["350020981234564", "1"]);
  const { url, init } = fetch.calls[0];
  assert.equal(url, "http://localhost:3000/api/v1/imei/validate");
  assert.equal(init.method, "POST");
  assert.deepEqual(JSON.parse(init.body), { imeis: ["350020981234564", "1"] });
  assert.equal(init.headers["Content-Type"], "application/json");
  assert.equal(init.headers["X-Test"], "1");
});

test("generate and generateIccid pass query params, skipping undefined", async () => {
  const fetch = mockFetch(() => ({ body: { imeis: [], iccids: [], notice: "" } }));
  const client = new ImeiLensClient({ fetch });
  await client.generate({ count: 3, brand: "apple", tac: undefined });
  await client.generateIccid({ country: "44", length: 20 });
  assert.equal(fetch.calls[0].url, "https://imeilens.com/api/v1/imei/generate?count=3&brand=apple");
  assert.equal(fetch.calls[1].url, "https://imeilens.com/api/v1/iccid/generate?country=44&length=20");
});

test("errors become ImeiLensApiError", async () => {
  const fetch = mockFetch(() => ({
    status: 429,
    body: { error: "rate_limited", message: "Too many requests. Try again in a minute." },
    headers: { "Retry-After": "60" },
  }));
  const client = new ImeiLensClient({ fetch });
  await assert.rejects(client.validate("1"), (err) => {
    assert.ok(err instanceof ImeiLensApiError);
    assert.equal(err.status, 429);
    assert.equal(err.code, "rate_limited");
    assert.equal(err.retryAfter, 60);
    return true;
  });
});
