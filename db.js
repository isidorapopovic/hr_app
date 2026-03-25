const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

// Optional: safer defaults
db.pragma('journal_mode = WAL');

module.exports = db;