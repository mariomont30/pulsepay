module.exports = {
  ...require('./jest.config'),
  transform: {},
  collectCoverage: true,
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.js', 'worker/**/*.js'],
  coverageReporters: ['json-summary', 'text', 'html'],
};
