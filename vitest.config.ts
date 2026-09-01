import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Adapter tests live beside their adapter, per the source-adapter contract.
    include: ["tests/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
