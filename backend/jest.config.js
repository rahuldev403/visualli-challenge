/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/src/test/setupEnv.ts"],
  clearMocks: true,
  restoreMocks: true,
};
