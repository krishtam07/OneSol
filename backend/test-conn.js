require('dotenv').config();
const mysql = require('mysql2/promise');

async function test() {
  console.log('Attempting connection with:');
  console.log('  host:', process.env.DB_HOST || 'localhost');
  console.log('  port:', process.env.DB_PORT || '3306');
  console.log('  user:', process.env.DB_USER || 'root');
  console.log('  password:', process.env.DB_PASSWORD === '' ? '(empty)' : '(set)');
  
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
    });
    console.log('✅ Connected!');
    const [rows] = await conn.query('SELECT VERSION() AS v');
    console.log('MySQL version:', rows[0].v);
    await conn.end();
  } catch (err) {
    console.error('❌ Connection error:', err.code, err.message);
  }
}
test();
