const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': require.resolve('ts-jest'),
  },
  setupFilesAfterEnv: [path.join(__dirname, 'test/setup.js')],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  testMatch: ['**/test/**/*.test.ts'],
}