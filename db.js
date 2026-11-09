const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:317464192@localhost:5432/licencias_vealo';

// Supabase and cloud databases require SSL; localhost does not.
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString: connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle postgres client', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};


