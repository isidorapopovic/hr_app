const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function main() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    await pool.query(schemaSql);
    console.log('PostgreSQL schema applied successfully.');
    await pool.end();
}

main().catch((err) => {
    console.error('Failed to apply schema:', err);
    process.exit(1);
});