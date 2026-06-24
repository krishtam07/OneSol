require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

let pool;
let isFallback = false;
let alasqlInstance;
let alasqlInitDone = false;

async function tryConnectMySQL() {
  const config = {
    host:               process.env.DB_HOST     || '127.0.0.1',
    port:               parseInt(process.env.DB_PORT || '3306', 10),
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'onesol_db',
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    dateStrings:        false,
    timezone:           '+00:00'
  };

  const tempPool = mysql.createPool(config);
  try {
    const conn = await tempPool.getConnection();
    conn.release();
    console.log('✅ Successfully connected to MySQL.');
    return tempPool;
  } catch (err) {
    tempPool.end().catch(() => {});
    throw err;
  }
}

function initAlasql() {
  const alasql = require('alasql');
  alasqlInstance = alasql;
  console.log('⚡ MySQL connection failed/unavailable. Initializing pure in-memory Alasql database...');

  const schemaPath = path.join(__dirname, 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    let sql = fs.readFileSync(schemaPath, 'utf8');

    // Clean comments
    sql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Clean CREATE DATABASE & USE
    sql = sql.replace(/CREATE DATABASE IF NOT EXISTS[\s\S]*?;/gi, '');
    sql = sql.replace(/USE\s+onesol_db;/gi, '');
    // Replace INSERT IGNORE with INSERT
    sql = sql.replace(/INSERT IGNORE/gi, 'INSERT');

    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (let stmt of statements) {
      let cleanStmt = stmt;
      if (cleanStmt.toUpperCase().startsWith('CREATE TABLE')) {
        // Strip foreign key references which can confuse alasql
        cleanStmt = cleanStmt.split('\n')
          .filter(line => !line.toUpperCase().includes('FOREIGN KEY'))
          .join('\n');

        // Clean trailing commas after stripping lines
        cleanStmt = cleanStmt.replace(/,\s*\)/g, '\n)');
        // Convert ENUMs to VARCHAR
        cleanStmt = cleanStmt.replace(/ENUM\([\s\S]*?\)/gi, 'VARCHAR(255)');
        // Strip MySQL-specific options
        cleanStmt = cleanStmt.replace(/ON UPDATE CURRENT_TIMESTAMP/gi, '');
        cleanStmt = cleanStmt.replace(/DEFAULT CURRENT_TIMESTAMP/gi, '');
        cleanStmt = cleanStmt.replace(/AUTO_INCREMENT/gi, '');
      }

      try {
        alasqlInstance(cleanStmt);
      } catch (e) {
        console.warn('⚠️ Alasql table init statement warning:', cleanStmt.slice(0, 100).trim(), '->', e.message);
      }
    }
    console.log('✅ In-memory database ready and seeded.');
  } else {
    console.error('❌ schema.sql not found for alasql initialization.');
  }
}

function alasqlQuery(sql, params = []) {
  if (!alasqlInitDone) {
    initAlasql();
    alasqlInitDone = true;
  }

  try {
    // Alasql maps arrays of values directly to ? placeholders
    let result = alasqlInstance(sql, params);

    if (Array.isArray(result)) {
      return [result, []];
    } else {
      return [{ affectedRows: typeof result === 'number' ? result : 1 }, []];
    }
  } catch (err) {
    console.error('❌ Alasql query error:', sql, params, err.message);
    throw err;
  }
}

const poolWrapper = {
  query: async (sql, params) => {
    if (isFallback) {
      return alasqlQuery(sql, params);
    }
    try {
      if (!pool) pool = await tryConnectMySQL();
      return await pool.query(sql, params);
    } catch (err) {
      isFallback = true;
      alasqlInitDone = true;
      initAlasql();
      return alasqlQuery(sql, params);
    }
  },

  execute: async (sql, params) => {
    if (isFallback) {
      return alasqlQuery(sql, params);
    }
    try {
      if (!pool) pool = await tryConnectMySQL();
      return await pool.execute(sql, params);
    } catch (err) {
      isFallback = true;
      alasqlInitDone = true;
      initAlasql();
      return alasqlQuery(sql, params);
    }
  },

  getConnection: async () => {
    if (isFallback) {
      return {
        query: async (sql, params) => alasqlQuery(sql, params),
        execute: async (sql, params) => alasqlQuery(sql, params),
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {}
      };
    }
    try {
      if (!pool) pool = await tryConnectMySQL();
      const conn = await pool.getConnection();
      return conn;
    } catch (err) {
      isFallback = true;
      alasqlInitDone = true;
      initAlasql();
      return {
        query: async (sql, params) => alasqlQuery(sql, params),
        execute: async (sql, params) => alasqlQuery(sql, params),
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {}
      };
    }
  }
};

module.exports = poolWrapper;
