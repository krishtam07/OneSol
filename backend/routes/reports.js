const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/reports/csv  — returns CSV as plain text
router.get('/csv', async (req, res) => {
  try {
    const [customers] = await pool.query('SELECT * FROM customers');
    const [bookings]  = await pool.query('SELECT * FROM bookings');
    const [devices]   = await pool.query('SELECT * FROM devices');

    let csv = 'Customer Name,Email,Phone,Target Device,Serial Number,Verification Status,Risk Flags,Assigned Owner,Last Updated\r\n';

    customers.forEach(cust => {
      const custBookings = bookings.filter(b => b.customerId === cust.id);
      let targetDevice = 'Pending';
      let serialNumber = 'N/A';

      if (custBookings.length > 0) {
        const active = custBookings.find(b => b.returnStatus !== 'returned') || custBookings[0];
        const dev = devices.find(d => d.id === active.deviceId);
        if (dev) { targetDevice = dev.name; serialNumber = dev.serialNumber; }
      }

      const flags = Array.isArray(cust.riskFlags)
        ? cust.riskFlags.join(' | ')
        : (cust.riskFlags ? JSON.parse(cust.riskFlags).join(' | ') : '');

      const row = [
        `"${cust.name}"`, `"${cust.email}"`, `"${cust.phone}"`,
        `"${targetDevice}"`, `"${serialNumber}"`, `"${cust.status}"`,
        `"${flags}"`, `"${cust.assignedStaff}"`, `"${cust.timestamp}"`
      ];
      csv += row.join(',') + '\r\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
  } catch (err) {
    console.error('[reports GET /csv]', err);
    res.status(500).json({ status: 500, error: 'Error generating CSV report' });
  }
});

module.exports = router;
