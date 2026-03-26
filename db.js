const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, 'hr_system.db');
const sqlite = new Database(dbPath);

sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

function all(sql, params = []) {
    return Promise.resolve(sqlite.prepare(sql).all(...params));
}

function get(sql, params = []) {
    return Promise.resolve(sqlite.prepare(sql).get(...params));
}

function run(sql, params = []) {
    return Promise.resolve(sqlite.prepare(sql).run(...params));
}

sqlite.all = all;
sqlite.get = get;
sqlite.run = run;

module.exports = sqlite;