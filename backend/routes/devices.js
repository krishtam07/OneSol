const express = require('express');
const router = express.Router();
const pool = require('../db');

// ── GET /api/devices ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const start = Date.now();
  const { search = '' } = req.query;
  try {
    let sql = 'SELECT * FROM devices';
    const params = [];
    if (search) {
      sql += ' WHERE name LIKE ? OR serialNumber LIKE ?';
      const like = `%${search}%`;
      params.push(like, like);
    }
    sql += ' ORDER BY createdAt ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ status: 200, data: rows, _meta: { duration: Date.now() - start } });
  } catch (err) {
    console.error('[devices GET /]', err);
    res.status(500).json({ status: 500, error: 'Database error listing inventory' });
  }
});

// ── POST /api/devices ─────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const start = Date.now();
  const { name, serialNumber, rentPerDay, deposit, condition = 'excellent', status = 'available', rentDays = 7 } = req.body;

  if (!name || !serialNumber || !rentPerDay || !deposit) {
    return res.status(400).json({ status: 400, error: 'Missing mandatory fields: Name, Serial, Rent, and Deposit are required.' });
  }

  try {
    const [[exists]] = await pool.query(
      'SELECT id FROM devices WHERE LOWER(serialNumber) = LOWER(?)',
      [serialNumber.trim()]
    );
    if (exists) {
      return res.status(400).json({ status: 400, error: `Product with serial number "${serialNumber}" already exists in inventory.` });
    }

    const id = `dev_${Date.now()}`;
    const newDevice = {
      id,
      name: name.trim(),
      serialNumber: serialNumber.toUpperCase().trim(),
      rentPerDay: parseInt(rentPerDay, 10),
      deposit: parseInt(deposit, 10),
      condition,
      status,
      repairCost: 0,
      rentDays: parseInt(rentDays, 10) || 7
    };

    await pool.query(
      'INSERT INTO devices (id, name, serialNumber, status, `condition`, rentPerDay, deposit, repairCost, rentDays) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, newDevice.name, newDevice.serialNumber, newDevice.status, newDevice.condition, newDevice.rentPerDay, newDevice.deposit, 0, newDevice.rentDays]
    );

    res.json({ status: 200, data: newDevice, _meta: { duration: Date.now() - start } });
  } catch (err) {
    console.error('[devices POST /]', err);
    res.status(500).json({ status: 500, error: 'Database error adding product' });
  }
});

// ── PUT /api/devices/:id ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const start = Date.now();
  const { id } = req.params;
  const { name, serialNumber, rentPerDay, deposit, condition, status, repairCost, rentDays } = req.body;

  if (!name || !serialNumber || !rentPerDay || !deposit) {
    return res.status(400).json({ status: 400, error: 'Fields Name, Serial, Rent, and Deposit are required.' });
  }

  try {
    const [[device]] = await pool.query('SELECT id FROM devices WHERE id = ?', [id]);
    if (!device) return res.status(404).json({ status: 404, error: `Device ${id} not found.` });

    await pool.query(
      'UPDATE devices SET name=?, serialNumber=?, rentPerDay=?, deposit=?, `condition`=?, status=?, repairCost=?, rentDays=? WHERE id=?',
      [name.trim(), serialNumber.toUpperCase().trim(), parseInt(rentPerDay, 10), parseInt(deposit, 10),
        condition, status, parseInt(repairCost, 10) || 0, parseInt(rentDays, 10) || 7, id]
    );

    const [[updated]] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
    res.json({ status: 200, data: updated, _meta: { duration: Date.now() - start } });
  } catch (err) {
    console.error('[devices PUT /:id]', err);
    res.status(500).json({ status: 500, error: 'Database error updating product' });
  }
});

// ── DELETE /api/devices/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const start = Date.now();
  const { id } = req.params;
  try {
    const [[device]] = await pool.query('SELECT * FROM devices WHERE id = ?', [id]);
    if (!device) return res.status(404).json({ status: 404, error: `Device ${id} not found.` });

    const [[active]] = await pool.query(
      "SELECT id FROM bookings WHERE deviceId = ? AND returnStatus != 'returned' LIMIT 1",
      [id]
    );
    if (active) {
      return res.status(400).json({
        status: 400,
        error: `Cannot delete device "${device.name}" because it is currently assigned to an active booking.`
      });
    }

    await pool.query('DELETE FROM devices WHERE id = ?', [id]);
    res.json({
      status: 200,
      data: { message: `Device "${device.name}" deleted from inventory successfully.` },
      _meta: { duration: Date.now() - start }
    });
  } catch (err) {
    console.error('[devices DELETE /:id]', err);
    res.status(500).json({ status: 500, error: 'Database error deleting product' });
  }
});

module.exports = router;
