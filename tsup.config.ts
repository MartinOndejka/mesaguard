import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/cli.ts"],
    format: ["esm"],
    dts: true,
    sourcemap: true,
    clean: true,
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: { action: "src/action.ts" },
    format: ["cjs"],
    platform: "node",
    target: "node24",
    bundle: true,
    sourcemap: true,
    outExtension: () => ({ js: ".cjs" }),
  },
]);
