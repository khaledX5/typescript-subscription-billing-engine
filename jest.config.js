// Jest runs in native ESM mode (NestJS 12 ships as ESM only); see the `test` npm script.
/** @type {import('jest').Config} */
const base = {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  // Source files import siblings with the `.js` extension required by Node ESM;
  // map them back to the `.ts` sources for ts-jest.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
  setupFiles: ['<rootDir>/test/setup.ts'],
};

/** @type {import('jest').Config} */
export default {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.int-spec.ts'],
    },
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    // Process bootstrap only (listen on a port); everything it wires is covered via AppModule.
    '!src/main.ts',
  ],
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    global: { statements: 85, branches: 85, functions: 85, lines: 85 },
  },
};
