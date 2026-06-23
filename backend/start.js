/**
 * start.js — Launches MySQL (if not running) then starts the Express server.
 * Run with: node start.js
 */
require('dotenv').config();
const { spawn, execSync } = require('child_process');
const path = require('path');
const mysql = require('mysql2/promise');
const fs    = require('fs');

const MYSQL_BIN  = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqld.exe';
const MYSQL_INI  = 'C:\\Users\\shanmukhi\\mysql-data\\my.ini';
const DB_HOST    = process.env.DB_HOST || '127.0.0.1';
const DB_PORT    = parseInt(process.env.DB_PORT || '3306', 10);

async function isMySQLRunning() {
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST, port: DB_PORT,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      connectTimeout: 3000
    });
    await conn.end();
    return true;
  } catch { return false; }
}

async function waitForMySQL(maxSeconds = 30) {
  for (let i = 0; i < maxSeconds; i++) {
    if (await isMySQLRunning()) return true;
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log('🔍 Checking MySQL status...');

  if (!(await isMySQLRunning())) {
    console.log('⚡ MySQL not running. Starting mysqld...');
    const mysqld = spawn(MYSQL_BIN, [`--defaults-file=${MYSQL_INI}`], {
      detached: true,
      stdio: 'ignore'
    });
    mysqld.unref();

    process.stdout.write('⏳ Waiting for MySQL to be ready ');
    const ready = await waitForMySQL(30);
    console.log('');

    if (!ready) {
      console.error('❌ MySQL did not start within 30 seconds. Check mysql-data/LAPTOP-20N1QLFB.err');
      process.exit(1);
    }
    console.log('✅ MySQL is up!');
  } else {
    console.log('✅ MySQL already running.');
  }

  // Run setup if needed (check if tables exist)
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST, port: DB_PORT,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    const dbName = process.env.DB_NAME || 'onesol_db';
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${dbName}\``);

    const [[{ cnt }]] = await conn.query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'customers'", [dbName]);

    if (cnt === 0) {
      console.log('🌱 Database empty — running schema & seed...');
      const rawSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
      const statements = rawSQL.split(';').map(s => s.trim()).filter(s => s.length > 0)
        .filter(s => !s.toUpperCase().startsWith('CREATE DATABASE'))
        .filter(s => !s.toUpperCase().startsWith('USE '));

      for (const stmt of statements) {
        try { await conn.query(stmt); } catch (e) {
          if (e.code !== 'ER_TABLE_EXISTS_ERROR') console.warn('  ⚠️', e.message.slice(0, 60));
        }
      }
      console.log('✅ Schema & seed applied.');
    } else {
      console.log('✅ Database already initialised.');
    }
    await conn.end();
  } catch (err) {
    console.error('❌ DB setup error:', err.message);
    process.exit(1);
  }

  // Start Express server
  console.log('\n🚀 Starting Express API server...');
  require('./index');
}

main();
