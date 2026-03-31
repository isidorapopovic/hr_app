const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
});

async function query(text, params = []) {
    return pool.query(text, params);
}

async function get(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows[0] || null;
}

async function all(text, params = []) {
    const result = await pool.query(text, params);
    return result.rows;
}

async function run(text, params = []) {
    return pool.query(text, params);
}

module.exports = {
    pool,
    query,
    get,
    all,
    run
};