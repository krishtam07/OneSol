const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/admin/create-booking
router.post('/', async (req, res) => {
  const start = Date.now();
  const { customerId, deviceId, depositDays = 7 } = req.body;

  try {
    const conn = await pool.getConnection();
    try {
      const [[device]]   = await conn.query('SELECT * FROM devices WHERE id = ?', [deviceId]);
      const [[customer]] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);

      if (!device || !customer) {
        return res.status(404).json({ status: 404, error: 'Customer or Device does not exist.' });
      }
      if (device.status !== 'available') {
        return res.status(400).json({ status: 400, error: 'Device is not available for rental.' });
      }

      const days = device.rentDays || depositDays || 7;
      const today = new Date();
      const returnDate = new Date();
      returnDate.setDate(today.getDate() + days);

      const toDateStr = (d) => d.toISOString().split('T')[0];
      const id = `book_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      await conn.query(
        'INSERT INTO bookings (id, customerId, deviceId, startDate, endDate, deposit, returnStatus) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, customerId, deviceId, toDateStr(today), toDateStr(returnDate), device.deposit, 'on_time']
      );

      if (customer.status === 'approved' && customer.signature) {
        await conn.query("UPDATE devices SET status='rented' WHERE id=?", [deviceId]);
      }

      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await conn.query(
        'INSERT INTO audit_logs (id, customerId, action, operator, notes, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, customerId, 'RENTAL_BOOKED', 'System Scheduler',
          `Rental booking for ${device.name}. Serial: ${device.serialNumber}. Scheduled return: ${toDateStr(returnDate)}`,
          new Date()]
      );

      const booking = { id, customerId, deviceId, startDate: toDateStr(today), endDate: toDateStr(returnDate), deposit: device.deposit, returnStatus: 'on_time' };
      res.json({ status: 200, data: { message: 'Booking created successfully', booking }, _meta: { duration: Date.now() - start } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[bookings POST /]', err);
    res.status(500).json({ status: 500, error: 'Database error making booking' });
  }
});

// DELETE /api/admin/create-booking
router.delete('/', async (req, res) => {
  const start = Date.now();
  const { customerId, deviceId } = req.body;

  if (!customerId || !deviceId) {
    return res.status(400).json({ status: 400, error: 'customerId and deviceId are required.' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [[booking]] = await conn.query(
        "SELECT * FROM bookings WHERE customerId = ? AND deviceId = ? AND returnStatus != 'returned' LIMIT 1",
        [customerId, deviceId]
      );

      if (!booking) {
        return res.status(404).json({ status: 404, error: 'No active booking found for this customer and device.' });
      }

      await conn.query("DELETE FROM bookings WHERE id = ?", [booking.id]);
      await conn.query("UPDATE devices SET status='available' WHERE id=?", [deviceId]);

      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await conn.query(
        'INSERT INTO audit_logs (id, customerId, action, operator, notes, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, customerId, 'RENTAL_DESELECTED', 'System Scheduler',
          `Rental selection removed for device ID: ${deviceId}.`, new Date()]
      );

      res.json({ status: 200, data: { message: 'Booking removed successfully' }, _meta: { duration: Date.now() - start } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[bookings DELETE /]', err);
    res.status(500).json({ status: 500, error: 'Database error removing booking' });
  }
});

module.exports = router;
