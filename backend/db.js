require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'onesol_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  // Return JS Date objects for DATE/DATETIME columns
  dateStrings:        false,
  timezone:           '+00:00'
});

module.exports = pool;
