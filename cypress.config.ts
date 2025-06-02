import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "tests/cypress/support/e2e.ts",
    specPattern: "tests/cypress/e2e/**/*"
  }
});
