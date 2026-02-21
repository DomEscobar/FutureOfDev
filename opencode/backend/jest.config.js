module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/controllers/**/*.js',
    'src/models/**/*.js',
    '!src/models/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.js'],
  moduleNameMapper: {
    '^@controllers(.*)$': '<rootDir>/src/controllers$1',
    '^@models(.*)$': '<rootDir>/src/models$1',
    '^@middleware(.*)$': '<rootDir>/src/middleware$1',
    '^@utils(.*)$': '<rootDir>/src/utils$1'
  },
  verbose: true,
  testTimeout: 10000
};
