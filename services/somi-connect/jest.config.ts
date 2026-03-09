import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],

  // Limit parallel workers to avoid resource contention when each integration
  // test file spins up its own MongoMemoryReplSet instance.
  maxWorkers: '50%',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
  ],

  // Set required environment variables before any module is imported.
  // This must happen before config/env.ts is loaded (which validates at
  // import time via requireEnv).
  setupFiles: ['<rootDir>/src/__tests__/jest.setup.ts'],

  // ts-jest configuration: use the project's tsconfig but override the module
  // format to CommonJS so Jest can process the source files that use Node16
  // module resolution (which emits .js extensions in imports).
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'CommonJS',
          moduleResolution: 'node',
        },
      },
    ],
  },

  // Map .js extension imports (used in the source) back to their .ts source
  // files when running under Jest/CommonJS.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
