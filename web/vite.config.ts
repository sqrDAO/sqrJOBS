import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// The contract ABI lives one level up (../abi) so the web app, CLI and skill share it.
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [repoRoot] } },
  test: { include: ["src/**/*.test.ts"] },
});
