module.exports = {
    testEnvironment: 'node',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/worker/src/$1'
    },
    transform: {
        '^.+\\.jsx?$': 'babel-jest'
    },
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/tenants/'
    ],
    modulePathIgnorePatterns: [
        '<rootDir>/tenants/'
    ],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    moduleFileExtensions: ['js', 'json', 'node'],
    setupFilesAfterEnv: ['./tests/setup.js']
};
