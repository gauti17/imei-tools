# imei-tools

Validate, analyze and generate **IMEI**, **IMEISV**, **MEID / pESN** and **ICCID** numbers in JavaScript and TypeScript.

- Zero runtime dependencies, tree-shakeable
- TypeScript types included, ESM and CommonJS builds
- Works in Node.js 18+, browsers, Deno, Bun, Cloudflare Workers and other edge runtimes
- Same algorithms as the free online tools at [imeilens.com](https://imeilens.com), plus an optional client for the [IMEILens API](https://imeilens.com/en/developers)

> **Testing only.** Generated IMEIs and ICCIDs are random, checksum-valid values for software testing, QA and demo data. They are not assigned to any device or SIM card. Never use a generated IMEI on a real device: changing a phone's IMEI is illegal in many countries.

## Install

```sh
npm install imei-tools
```

## Usage

```ts
import { isValidImei, analyzeImei, generateImei } from "imei-tools";

isValidImei("350020981234564"); // true
isValidImei("35-002098-123456-4"); // true (spaces, dashes, slashes and dots are ignored)
isValidImei("350020981234565"); // false (wrong check digit)

analyzeImei("350020981234564");
// {
//   input: "350020981234564",
//   digits: "350020981234564",
//   valid: true,
//   tac: "35002098",         // Type Allocation Code (device model)
//   reportingBody: "35",
//   serial: "123456",
//   checkDigit: 4,
//   expectedCheckDigit: 4
// }

generateImei(); // ["001234567890128"]  (starts with 00, the test reporting body)
generateImei({ count: 5 }); // 5 unique test IMEIs
generateImei({ tac: "35002098", count: 3 }); // fixed 8-digit TAC
generateImei({ prefix: "0112" }); // any leading digits (up to 14)
```

CommonJS works too:

```js
const { isValidImei } = require("imei-tools");
```

### IMEISV

```ts
import { imeiToImeisv, imeisvToImei } from "imei-tools";

imeiToImeisv("490154203237518", "09"); // "4901542032375109"
imeisvToImei("4901542032375109"); // { imei: "490154203237518", svn: "09" }
```

### MEID and pESN (CDMA)

```ts
import { meidHexToDec, meidDecToHex, pesnFromMeid, meidCheckDigit, convertMeid } from "imei-tools";

meidHexToDec("AF0123450ABCDE"); // "293608736500703710"
meidDecToHex("293608736500703710"); // "AF0123450ABCDE"
pesnFromMeid("AF0123450ABCDE"); // { hex: "8016B128", dec: "12801487144" }
meidCheckDigit("AF0123450ABCDE"); // "C"
convertMeid("293608736500703710"); // { hex, dec, pesnHex, pesnDec, checkDigit }
```

The pESN is `0x80` followed by the last 24 bits of the SHA-1 hash of the 7 MEID bytes. To keep the helpers **synchronous** and dependency-free, the package ships a small inline SHA-1 implementation (tested against `node:crypto`). It does not need Web Crypto, so it also works on plain `http://` pages where `crypto.subtle` is unavailable. It is only used for this public mapping and is not meant for security purposes.

### ICCID (SIM card numbers)

```ts
import { isValidIccid, analyzeIccid, generateIccid, ICCID_COUNTRIES } from "imei-tools";

isValidIccid("8901260000000000006"); // true
analyzeIccid("8901260000000000006"); // { valid: true, industry: "89", country: "01", countryName: "USA / Canada", ... }
generateIccid(); // "8901..." 19 digits, test value
generateIccid({ country: "44", length: 20 }); // UK calling code, 20 digits
```

### Hosted API client (optional)

The offline helpers cover checksums and formats. The free, keyless [IMEILens API](https://imeilens.com/en/developers) adds a device lookup (brand and model from the TAC database) and test IMEIs from real TAC ranges of a brand.

```ts
import { ImeiLensClient, ImeiLensApiError } from "imei-tools";

const client = new ImeiLensClient(); // or new ImeiLensClient({ baseUrl, fetch, headers })

const result = await client.validate("490154203237518");
// { imei, valid, type: "imei", tac, reporting_body, serial, check_digit, expected_check_digit, device: { brand, model } | null }

await client.validateMany(["490154203237518", "350020981234564"]); // up to 100 per request
await client.generate({ count: 5, brand: "apple" }); // { imeis: [{ imei, tac, model }], notice }
await client.generateIccid({ count: 3, country: "49" }); // { iccids: [...], notice }

try {
  await client.validate("123");
} catch (err) {
  if (err instanceof ImeiLensApiError) console.log(err.status, err.code, err.retryAfter);
}
```

The API is rate limited to 60 requests per minute per IP. The OpenAPI spec is at [imeilens.com/openapi.json](https://imeilens.com/openapi.json).

## API

| Function | Returns | Description |
| --- | --- | --- |
| `isValidImei(input)` | `boolean` | 15 digits with a correct Luhn check digit. IMEISVs return `false`. |
| `analyzeImei(input)` | `ImeiAnalysis` | Validity, `reason` (`length`, `checksum`, `chars`), TAC, reporting body, serial, check digit. Also accepts 16-digit IMEISVs (`isImeisv`, `svn`). |
| `generateImei({ count?, tac?, prefix?, random? })` | `string[]` | Unique Luhn-valid test IMEIs. Default prefix `00`. `count` 1 to 1000. Throws `RangeError` for a bad `tac` or `prefix`. |
| `luhnCheckDigit(body)` | `number` | Luhn check digit for the digits before it. |
| `imeiToImeisv(imei, svn)` | `string \| null` | IMEI + 2-digit software version to IMEISV. |
| `imeisvToImei(imeisv)` | `{ imei, svn } \| null` | IMEISV to IMEI with a recalculated check digit. |
| `meidHexToDec(hex)` | `string \| null` | 14 hex digits to 18 decimal digits. |
| `meidDecToHex(dec)` | `string \| null` | 18 decimal digits to 14 hex digits. |
| `meidCheckDigit(meid)` | `string \| null` | Base-16 Luhn check digit of a MEID. |
| `pesnFromMeid(meid)` | `{ hex, dec } \| null` | Pseudo-ESN from a hex or decimal MEID (synchronous). |
| `convertMeid(meid)` | `MeidConversion \| null` | All MEID formats at once. |
| `isValidIccid(input)` | `boolean` | 18 to 22 digits, starts with `89`, correct Luhn check digit. |
| `analyzeIccid(input)` | `IccidAnalysis` | Validity, `reason` (`length`, `prefix`, `checksum`), country code and name. |
| `generateIccid({ country?, length?, random? })` | `string` | One Luhn-valid test ICCID. `country` defaults to `01`, `length` is 19 or 20. |
| `ICCID_COUNTRIES` | `{ code, name }[]` | Country calling codes with names. |
| `onlyDigits(input)` | `string` | Removes everything except digits. |
| `new ImeiLensClient(options?)` | client | `validate`, `validateMany`, `generate`, `generateIccid` over the hosted API. |

### Randomness

Generators use Web Crypto `getRandomValues` with rejection sampling, so every digit is equally likely. On runtimes without a global `crypto` (Node 18) they fall back to `Math.random`. Pass `random: () => number` to use your own source, for example a seeded PRNG for reproducible fixtures.

## Online tools

Prefer a UI? The same algorithms power the free tools at [imeilens.com](https://imeilens.com): IMEI checker, IMEI generator, MEID converter, IMEISV converter and ICCID generator. API documentation: [imeilens.com/en/developers](https://imeilens.com/en/developers).

## License

[MIT](./LICENSE) © IMEILens
