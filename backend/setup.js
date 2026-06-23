/**
 * setup.js — One-time database initialisation script.
 * Run with: node setup.js
 * This creates the database, tables, and seeds default data using mysql2.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function setup() {
  console.log('🔧 One Point Solutions — Database Setup');
  console.log('─'.repeat(45));

  // Connect without specifying a database first (so we can CREATE DATABASE)
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    const dbName = process.env.DB_NAME || 'onesol_db';

    console.log(`📌 Creating database '${dbName}' if not exists...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);
    console.log('✅ Database ready.');

    // Read schema file and split into individual statements
    const schemaPath = path.join(__dirname, 'schema.sql');
    const rawSQL     = fs.readFileSync(schemaPath, 'utf8');

    // Remove USE / CREATE DATABASE lines (already done above)
    const statements = rawSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.toUpperCase().startsWith('CREATE DATABASE'))
      .filter(s => !s.toUpperCase().startsWith('USE '));

    console.log(`📋 Running ${statements.length} SQL statements...`);

    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (err) {
        // Ignore "table already exists" errors — they are safe
        if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
          console.warn(`   ⚠️  Non-fatal warning: ${err.message.slice(0, 80)}`);
        }
      }
    }

    // Verify tables exist
    const [tables] = await conn.query(`SHOW TABLES IN \`${dbName}\``);
    console.log('\n📊 Tables created:');
    tables.forEach(t => console.log(`   ✅ ${Object.values(t)[0]}`));

    // Verify seed counts
    const [[{ c: custCount }]]  = await conn.query(`SELECT COUNT(*) AS c FROM \`${dbName}\`.customers`);
    const [[{ c: devCount }]]   = await conn.query(`SELECT COUNT(*) AS c FROM \`${dbName}\`.devices`);
    const [[{ c: bookCount }]]  = await conn.query(`SELECT COUNT(*) AS c FROM \`${dbName}\`.bookings`);
    const [[{ c: logCount }]]   = await conn.query(`SELECT COUNT(*) AS c FROM \`${dbName}\`.audit_logs`);

    console.log('\n🌱 Seed data:');
    console.log(`   • customers:  ${custCount} rows`);
    console.log(`   • devices:    ${devCount} rows`);
    console.log(`   • bookings:   ${bookCount} rows`);
    console.log(`   • audit_logs: ${logCount} rows`);

    console.log('\n🚀 Setup complete! You can now run: node index.js');
  } finally {
    await conn.end();
  }
}

setup().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  if (err.code === 'ECONNREFUSED') {
    console.error('   → MySQL does not appear to be running. Please start it and retry.');
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('   → Access denied. Check DB_USER / DB_PASSWORD in backend/.env');
  }
  process.exit(1);
});
