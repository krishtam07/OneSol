
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/stats
router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const [[{ totalCustomers }]] = await pool.query('SELECT COUNT(*) AS totalCustomers FROM customers');
    const [[{ pendingKYC }]] = await pool.query("SELECT COUNT(*) AS pendingKYC FROM customers WHERE status = 'verification_in_progress'");
    const [[{ approvedAgreements }]] = await pool.query("SELECT COUNT(*) AS approvedAgreements FROM customers WHERE status = 'approved' AND signature != ''");
    const [[{ activeBookings }]] = await pool.query("SELECT COUNT(*) AS activeBookings FROM bookings WHERE returnStatus != 'returned'");
    const [[{ overdueReturns }]] = await pool.query("SELECT COUNT(*) AS overdueReturns FROM bookings WHERE returnStatus = 'overdue'");

    const data = { totalCustomers, pendingKYC, approvedAgreements, activeBookings, overdueReturns };
    res.json({ status: 200, data, _meta: { duration: Date.now() - start } });
  } catch (err) {
    console.error('[stats]', err);
    res.status(500).json({ status: 500, error: 'Internal Database Error' });
  }
});

module.exports = router;
