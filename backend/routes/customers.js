const express = require('express');
const router = express.Router();
const pool = require('../db');

// ── helpers ──────────────────────────────────────────────────────────────────

function validateIndianPhone(phoneStr) {
  const clean = (phoneStr || '').trim().replace(/[\s\-]/g, '');
  return /^(?:\+91|0)?[6-9]\d{9}$/.test(clean);
}

function parseFlags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

// Enrich a customer row with its active device info from bookings
async function enrichCustomer(cust, conn) {
  cust.riskFlags = parseFlags(cust.riskFlags);

  const [bookings] = await conn.query(
    "SELECT b.*, d.name AS deviceName, d.serialNumber FROM bookings b LEFT JOIN devices d ON b.deviceId = d.id WHERE b.customerId = ? ORDER BY b.startDate DESC",
    [cust.id]
  );

  let targetDevice = 'Pending';
  let serialNumber = 'N/A';

  if (bookings.length > 0) {
    const active = bookings.find(b => b.returnStatus !== 'returned') || bookings[0];
    if (active.deviceName) {
      targetDevice = active.deviceName;
      if (cust.status !== 'approved' || !cust.signature || cust.signature.trim() === '') {
        targetDevice = `Pending: ${targetDevice}`;
      }
      serialNumber = active.serialNumber;
    }
  }

  return { ...cust, targetDevice, serialNumber };
}

// ── GET /api/customers ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const start = Date.now();
  try {
    const { search = '', status = '', risk, sortColumn = 'timestamp', sortDir = 'desc' } = req.query;

    const allowedCols = ['name', 'email', 'phone', 'status', 'timestamp', 'assignedStaff'];
    const col = allowedCols.includes(sortColumn) ? sortColumn : 'timestamp';
    const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (risk === 'true' || risk === true) {
      sql += ' AND JSON_LENGTH(riskFlags) > 0';
    }

    sql += ` ORDER BY \`${col}\` ${dir}`;

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(sql, params);
      const enriched = await Promise.all(rows.map(r => enrichCustomer(r, conn)));
      res.json({ status: 200, data: enriched, _meta: { duration: Date.now() - start } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[customers GET /]', err);
    res.status(500).json({ status: 500, error: 'Internal Database Error' });
  }
});

// ── GET /api/customer/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const start = Date.now();
  const { id } = req.params;
  try {
    const conn = await pool.getConnection();
    try {
      const [[customer]] = await conn.query('SELECT * FROM customers WHERE id = ?', [id]);
      if (!customer) {
        return res.status(404).json({ status: 404, error: `Customer ${id} not found.` });
      }
      customer.riskFlags = parseFlags(customer.riskFlags);

      const [bookings] = await conn.query(
        'SELECT b.*, d.name AS deviceName, d.serialNumber, d.rentPerDay, d.deposit AS deviceDeposit, d.condition AS deviceCondition, d.status AS deviceStatus FROM bookings b LEFT JOIN devices d ON b.deviceId = d.id WHERE b.customerId = ? ORDER BY b.startDate DESC',
        [id]
      );

      const [auditLogs] = await conn.query(
        'SELECT * FROM audit_logs WHERE customerId = ? ORDER BY `timestamp` DESC',
        [id]
      );

      const enrichedBookings = bookings.map(b => ({
        ...b,
        device: b.deviceId ? {
          id: b.deviceId,
          name: b.deviceName,
          serialNumber: b.serialNumber,
          rentPerDay: b.rentPerDay,
          deposit: b.deviceDeposit,
          condition: b.deviceCondition,
          status: b.deviceStatus
        } : null
      }));

      res.json({
        status: 200,
        data: { profile: customer, bookings: enrichedBookings, auditLogs },
        _meta: { duration: Date.now() - start }
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[customers GET /:id]', err);
    res.status(500).json({ status: 500, error: 'Internal Database Error' });
  }
});

// ── POST /api/kyc ─────────────────────────────────────────────────────────────
router.post('/kyc', async (req, res) => {
  const start = Date.now();
  const { customerId, name, phone, email, address, idProofName, password } = req.body;

  if (!name || !phone || !email) {
    return res.status(400).json({ status: 400, error: 'Missing mandatory fields: Name, Phone, and Email are required.' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [[existing]] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
      const isNew = !existing;

      // Risk assessment
      const riskFlags = [];
      const cleanAddr = (address || '').trim();
      if (!cleanAddr) riskFlags.push('SYSTEM: Missing Physical Address');
      else if (cleanAddr.length < 10) riskFlags.push('SYSTEM: Short Address / High Risk Delivery Zone');
      if (!validateIndianPhone(phone)) riskFlags.push('SYSTEM: Invalid Phone Format');
      const idProof = idProofName || (existing ? existing.idProofName : '') || '';
      if (!idProof) riskFlags.push('SYSTEM: Missing ID Proof');

      const newStatus = idProof ? 'verification_in_progress' : 'pending_upload';
      const now = new Date();

      if (isNew) {
        await conn.query(
          'INSERT INTO customers (id, name, phone, email, address, idProofName, status, rejectionReason, riskFlags, signature, assignedStaff, `timestamp`, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [customerId, name.trim(), phone.trim(), email.trim().toLowerCase(), cleanAddr, idProof, newStatus, '', JSON.stringify(riskFlags), '', 'Sarah Jenkins', now, password || 'password123']
        );
      } else {
        await conn.query(
          "UPDATE customers SET name=?, phone=?, email=?, address=?, idProofName=?, status=?, riskFlags=?, signature='', `timestamp`=? WHERE id=?",
          [name.trim(), phone.trim(), email.trim().toLowerCase(), cleanAddr, idProof, newStatus, JSON.stringify(riskFlags), now, customerId]
        );

        // Also release booked devices back to 'available'
        const [activeBookings] = await conn.query(
          "SELECT deviceId FROM bookings WHERE customerId = ? AND returnStatus != 'returned'",
          [customerId]
        );
        for (const bk of activeBookings) {
          await conn.query("UPDATE devices SET status = 'available' WHERE id = ?", [bk.deviceId]);
        }
      }

      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await conn.query(
        'INSERT INTO audit_logs (id, customerId, action, operator, notes, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, customerId, isNew ? 'CUSTOMER_REGISTERED' : 'KYC_UPDATED', name.trim(),
          `Customer KYC fields saved. Risk Check: ${riskFlags.length} flags. Status: '${newStatus}'.`, now]
      );

      const [[updated]] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
      updated.riskFlags = parseFlags(updated.riskFlags);

      res.json({ status: 200, data: { message: 'KYC data successfully updated', customer: updated }, _meta: { duration: Date.now() - start } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[POST /kyc]', err);
    res.status(500).json({ status: 500, error: 'Internal DB Error while updating KYC' });
  }
});

// ── POST /api/verify ──────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  const start = Date.now();
  const { customerId, action, reason, operator } = req.body;

  if (!customerId || !action) {
    return res.status(400).json({ status: 400, error: 'customerId and action are required.' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [[customer]] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (!customer) return res.status(404).json({ status: 404, error: `Customer ${customerId} not found.` });

      if (action === 'reject') {
        if (!reason || reason.trim().length < 5) {
          return res.status(400).json({ status: 400, error: 'Rejection requires a detailed reason (at least 5 characters).' });
        }
        await conn.query("UPDATE customers SET status='rejected', rejectionReason=?, signature='', `timestamp`=? WHERE id=?",
          [reason.trim(), new Date(), customerId]);

        // Release booked devices back to 'available'
        const [activeBookings] = await conn.query(
          "SELECT deviceId FROM bookings WHERE customerId = ? AND returnStatus != 'returned'",
          [customerId]
        );
        for (const bk of activeBookings) {
          await conn.query("UPDATE devices SET status = 'available' WHERE id = ?", [bk.deviceId]);
        }
      } else if (action === 'approve') {
        await conn.query("UPDATE customers SET status='approved', rejectionReason='', `timestamp`=? WHERE id=?",
          [new Date(), customerId]);
      } else {
        return res.status(400).json({ status: 400, error: `Invalid action: ${action}` });
      }

      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await conn.query(
        'INSERT INTO audit_logs (id, customerId, action, operator, notes, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, customerId, action === 'approve' ? 'KYC_APPROVED' : 'KYC_REJECTED',
          operator || 'System Admin',
          action === 'approve'
            ? 'KYC verification successful. Rental Contract unlocked.'
            : `KYC verification failed. Reason: "${reason.trim()}"`,
          new Date()]
      );

      const [[updated]] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
      updated.riskFlags = parseFlags(updated.riskFlags);

      res.json({
        status: 200,
        data: { message: `Customer KYC ${action === 'approve' ? 'Approved' : 'Rejected'} successfully`, customer: updated },
        _meta: { duration: Date.now() - start }
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[POST /verify]', err);
    res.status(500).json({ status: 500, error: 'Database verification failure' });
  }
});

// ── POST /api/agreement ───────────────────────────────────────────────────────
router.post('/agreement', async (req, res) => {
  const start = Date.now();
  const { customerId, signatureText, checklistApproved } = req.body;

  try {
    const conn = await pool.getConnection();
    try {
      const [[customer]] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
      if (!customer) return res.status(404).json({ status: 404, error: 'Customer session not found' });
      if (customer.status !== 'approved') return res.status(400).json({ status: 400, error: 'Agreement cannot be executed. KYC must be APPROVED by Admin first.' });
      if (!signatureText || !checklistApproved) return res.status(400).json({ status: 400, error: 'Agreement terms must be fully accepted, signature field is mandatory.' });

      await conn.query("UPDATE customers SET signature=?, `timestamp`=? WHERE id=?",
        [signatureText.trim(), new Date(), customerId]);

      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await conn.query(
        'INSERT INTO audit_logs (id, customerId, action, operator, notes, `timestamp`) VALUES (?, ?, ?, ?, ?, ?)',
        [logId, customerId, 'AGREEMENT_SIGNED', customer.name,
          `Legal agreement digitally signed with signature name: "${signatureText.trim()}".`, new Date()]
      );

      // Activate available bookings → mark devices as rented
      const [custBookings] = await conn.query(
        "SELECT b.id, b.deviceId FROM bookings b JOIN devices d ON b.deviceId = d.id WHERE b.customerId = ? AND d.status = 'available'",
        [customerId]
      );
      for (const bk of custBookings) {
        await conn.query("UPDATE devices SET status='rented' WHERE id=?", [bk.deviceId]);
      }

      const [[updated]] = await conn.query('SELECT * FROM customers WHERE id = ?', [customerId]);
      updated.riskFlags = parseFlags(updated.riskFlags);

      res.json({
        status: 200,
        data: { message: 'Rental Agreement executed successfully', customer: updated },
        _meta: { duration: Date.now() - start }
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('[POST /agreement]', err);
    res.status(500).json({ status: 500, error: 'Database error signing agreement' });
  }
});

module.exports = router;
