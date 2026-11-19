import { defineConfig } from "tsup";

// Bundles ../abi/sqrJobsAbi.ts into dist/cli.js so the published CLI always
// carries the ABI it was built against. viem stays an external dependency.
export default defineConfig({
  entry: { cli: "src/index.ts" },
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
});
