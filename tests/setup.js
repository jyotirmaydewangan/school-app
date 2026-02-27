// tests/setup.js

// Mock Google Apps Script Globals
global.Utilities = {
    base64Encode: (str) => Buffer.from(str).toString('base64'),
    base64Decode: (str) => Buffer.from(str, 'base64').toString(),
    DigestAlgorithm: { SHA_256: 'SHA-256' },
    computeDigest: (algorithm, value) => {
        const crypto = require('crypto');
        return Array.from(crypto.createHash('sha256').update(value).digest());
    },
    newBlob: (content) => ({
        getDataAsString: () => content
    }),
    formatDate: (date, tz, format) => {
        return date.toISOString().split('T')[0];
    }
};

global.SpreadsheetApp = {
    getActiveSpreadsheet: jest.fn(),
    openById: jest.fn()
};

global.UrlFetchApp = {
    fetch: jest.fn()
};

global.CacheService = {
    getScriptCache: jest.fn(() => ({
        get: jest.fn(),
        put: jest.fn(),
        remove: jest.fn()
    }))
};

// Mock Cloudflare KV
global.MockKV = {
    data: new Map(),
    get: jest.fn(async (key, type) => {
        const val = global.MockKV.data.get(key);
        if (val === undefined) return null;
        if (type === 'json') {
            return typeof val === 'string' ? JSON.parse(val) : val;
        }
        return val;
    }),
    put: jest.fn(async (key, value, options) => {
        global.MockKV.data.set(key, value);
    }),
    delete: jest.fn(async (key) => {
        global.MockKV.data.delete(key);
    }),
    list: jest.fn(async (options) => {
        const keys = Array.from(global.MockKV.data.keys())
            .filter(k => !options.prefix || k.startsWith(options.prefix));
        return { keys: keys.map(name => ({ name })), list_complete: true };
    })
};

// Suppress all console output during tests for clean output
global.console.log = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();
global.console.info = jest.fn();
