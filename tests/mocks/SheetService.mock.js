/**
 * Shared in-memory Google Sheets mock for all Apps Script repository tests.
 * 
 * Usage (in test files):
 *   const { createSheetDB, makeRepo } = require('../mocks/SheetService.mock');
 */


let _uuidCounter = 1;


/**
 * Creates a lightweight in-memory "spreadsheet" that mimics the
 * Google Sheets API surface used by the Apps Script repositories.
 *
 * @param {string[]} headers - Column headers (first row)
 * @returns A mock sheet object with appendRow, getDataRange, deleteRow, getRange, flush
 */
function createMockSheet(headers) {
    const rows = [headers]; // row[0] = headers

    const sheet = {
        _rows: rows,
        _headers: headers,

        appendRow(row) {
            rows.push([...row]);
        },

        getDataRange() {
            return {
                getValues() { return rows.map(r => [...r]); },
                setValues(newValues) {
                    // Replace internal rows with new values
                    rows.length = 0;
                    newValues.forEach(r => rows.push([...r]));
                }
            };
        },

        getRange(rowNumber, colNumber) {
            return {
                setValue(value) {
                    rows[rowNumber - 1][colNumber - 1] = value;
                },
                getValue() {
                    return rows[rowNumber - 1][colNumber - 1];
                }
            };
        },

        deleteRow(rowNumber) {
            rows.splice(rowNumber - 1, 1);
        }
    };

    return sheet;
}

/**
 * Creates a complete multi-sheet database mock.
 * Returns { db, SheetService, makeId, now, flush }
 */
function createSheetDB(sheetDefinitions) {
    const db = {};

    for (const [name, headers] of Object.entries(sheetDefinitions)) {
        db[name] = createMockSheet(headers);
    }

    const SheetService = {
        getSheet(name) {
            if (!db[name]) throw new Error(`Sheet not found: ${name}`);
            return db[name];
        },
        flush() { }
    };

    const SpreadsheetApp = {
        getActiveSpreadsheet: () => ({ getSheetByName: (n) => db[n] }),
        flush: () => { }
    };

    const Utilities = {
        getUuid: () => `id-${_uuidCounter++}`,
    };

    const makeId = () => `id-${_uuidCounter++}`;
    const now = () => new Date().toISOString();

    return { db, SheetService, SpreadsheetApp, Utilities, makeId, now };
}

module.exports = { createMockSheet, createSheetDB };
