const path = require('path');

module.exports = {
  transform: {
    '^.+\\.tsx?$': require.resolve('ts-jest'),
  },
  setupFilesAfterEnv: [path.join(__dirname, 'test/setup.js')],
}