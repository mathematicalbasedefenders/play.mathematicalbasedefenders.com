import type { Config } from "jest";

const config: Config = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "^.+\\.jsx$": "babel-jest"
  },
  preset: "ts-jest",
  globalSetup: "<rootDir>/tests/jest/globalSetup.ts",
  globalTeardown: "<rootDir>/tests/jest/globalTeardown.ts",
  setupFilesAfterEnv: ["<rootDir>/tests/jest/setupFile.ts"],
  transformIgnorePatterns: []
};

export default config;
