require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const pool     = require('./db');
const fs       = require('fs');
const path     = require('path');

const app  = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:8080', 'http://127.0.0.1:8080'] }));
app.use(express.json());

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/stats',               require('./routes/stats'));
app.use('/api/customers',           require('./routes/customers'));
app.use('/api/devices',             require('./routes/devices'));
app.use('/api/admin/create-booking', require('./routes/bookings'));
app.use('/api/reports',             require('./routes/reports'));

// POST /api/debug/reset — re-seeds the database with default data
app.post('/api/debug/reset', async (req, res) => {
  try {
    const conn = await pool.getConnection();
    try {
      // Drop tables in dependency order
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.query('TRUNCATE TABLE audit_logs');
      await conn.query('TRUNCATE TABLE bookings');
      await conn.query('TRUNCATE TABLE customers');
      await conn.query('TRUNCATE TABLE devices');
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');

      // Re-run seed portion of schema.sql
      const schemaPath = path.join(__dirname, 'schema.sql');
      const sql = fs.readFileSync(schemaPath, 'utf8');

      // Extract only INSERT statements
      const inserts = sql
        .split(';')
        .map(s => s.replace(/--.*$/gm, '').trim())
        .filter(s => s.toUpperCase().startsWith('INSERT'));

      for (const stmt of inserts) {
        if (stmt) {
          await conn.query(stmt);
        }
      }
    } finally {
      conn.release();
    }
    res.json({ status: 200, data: { message: 'Database reset to localised default states' } });
  } catch (err) {
    console.error('[POST /api/debug/reset]', err);
    res.status(500).json({ status: 500, error: 'Reset failed: ' + err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Verify DB connection
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected successfully.');
    conn.release();

    app.listen(PORT, () => {
      console.log(`🚀 One Point Solutions API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err.message);
    console.error('   → Make sure MySQL is running and credentials in backend/.env are correct.');
    process.exit(1);
  }
}

start();
