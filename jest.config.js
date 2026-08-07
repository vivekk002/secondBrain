/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    // ESM-only package that ts-jest can't parse from node_modules; also a
    // real network call we never want triggered from tests.
    "^youtube-transcript-plus$":
      "<rootDir>/src/__mocks__/youtube-transcript-plus.ts",
  },
  setupFiles: ["<rootDir>/src/__tests__/env.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/db.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  clearMocks: true,
  testTimeout: 30000,
};
