// Marks dist/cjs as CommonJS so Node and TypeScript treat its .js and .d.ts files as CJS.
require("node:fs").writeFileSync(require("node:path").join(__dirname, "../dist/cjs/package.json"), '{ "type": "commonjs" }\n');
