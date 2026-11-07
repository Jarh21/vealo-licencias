const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:317464192@localhost:5432/licencias_vealo';

const pool = new Pool({
  connectionString: connectionString,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle postgres client', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};

