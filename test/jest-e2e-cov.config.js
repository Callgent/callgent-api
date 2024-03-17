// eslint-disable-next-line @typescript-eslint/no-var-requires
const jestConfig = require('./jest-e2e.config.js');

module.exports = {
  ...jestConfig,
  rootDir: '..',
};
