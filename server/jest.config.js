module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
