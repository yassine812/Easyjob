module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  setupFiles: ['<rootDir>/test/unit-env.cjs'],
  modulePathIgnorePatterns: ['<rootDir>/web/.next/', '<rootDir>/dist/', '<rootDir>/node_modules\\.[^/\\\\]+/'],
  testRegex: 'test/unit/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.spec.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: 1,
  clearMocks: true,
};
