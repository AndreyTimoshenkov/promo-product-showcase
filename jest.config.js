/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.(ts|mjs|js|html)$': ['jest-preset-angular', { tsconfig: '<rootDir>/tsconfig.spec.json', stringifyContentPathRegex: '\\.(html|svg)$' }],
  },
  transformIgnorePatterns: ['node_modules/(?!.*\\.mjs$|@angular/common/locales/)'],
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  maxWorkers: 2,
};
