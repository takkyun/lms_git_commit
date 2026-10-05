const { build } = require("esbuild");

build({
  entryPoints: ["./src/index.ts"],
  bundle: true,
  outfile: "dist/index.js",
  platform: "node",
  target: ["node24"],
  external: [],
}).catch(() => process.exit(1));
