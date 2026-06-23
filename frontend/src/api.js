/**
 * src/api.js - MySQL-backed API client for One Point Solutions
 * Replaces the former src/db.js mock. All functions keep identical
 * signatures so App.jsx requires only one import line change.
 */

const BASE_URL = '/api'; // Vite proxies /api → http://localhost:3001

// ── Utility helpers (pure JS, no backend needed) ──────────────────────────────

export function formatRupee(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

export function validateIndianPhone(phoneStr) {
  const clean = (phoneStr || '').trim().replace(/[\s\-]/g, '');
  return /^(?:\+91|0)?[6-9]\d{9}$/.test(clean);
}

// ── Console listener mechanism (mirrors db.js API) ────────────────────────────

const _listeners = [];

function _emit(method, url, status, payload, durationMs, error = null) {
  const entry = {
    timestamp: new Date().toLocaleTimeString(),
    method,
    url,
    status,
    duration: `${durationMs}ms`,
    payload: JSON.stringify(payload, null, 2),
    error: error ? String(error) : null
  };
  _listeners.forEach(fn => fn(entry));
}

async function _fetch(method, path, body, logUrl) {
  const t0 = Date.now();
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const resp = await fetch(url, opts);
    const json = await resp.json();
    const dur  = Date.now() - t0;

    _emit(method, logUrl || path, json.status || resp.status, json.data || json, dur);
    return json;
  } catch (err) {
    const dur = Date.now() - t0;
    _emit(method, logUrl || path, 0, null, dur, err);
    return { status: 500, error: 'Network error: ' + err.message };
  }
}

// ── db-compatible API object ──────────────────────────────────────────────────

export const db = {
  // Mirror db.addConsoleListener
  addConsoleListener(callback) {
    _listeners.push(callback);
  },

  // Mirror db.logConsole
  logConsole(method, url, status, payload, duration, error = null) {
    _emit(method, url, status, payload, duration, error);
  },

  // GET /api/stats
  async getStats() {
    return _fetch('GET', '/stats');
  },

  // GET /api/customers
  async getCustomers(filter = {}, sort = { column: 'timestamp', direction: 'desc' }) {
    const params = new URLSearchParams();
    if (filter.search)  params.set('search', filter.search);
    if (filter.status)  params.set('status', filter.status);
    if (filter.risk)    params.set('risk', 'true');
    params.set('sortColumn', sort.column   || 'timestamp');
    params.set('sortDir',    sort.direction || 'desc');

    return _fetch('GET', `/customers?${params}`, undefined, `/api/customers?${params}`);
  },

  // GET /api/customer/:id
  async getCustomerDetails(customerId) {
    return _fetch('GET', `/customers/${customerId}`, undefined, `/api/customer?id=${customerId}`);
  },

  // POST /api/kyc
  async updateKYC(customerId, kycData) {
    return _fetch('POST', '/customers/kyc', { customerId, ...kycData }, '/api/kyc');
  },

  // POST /api/agreement
  async submitAgreement(customerId, agreementData) {
    return _fetch('POST', '/customers/agreement', { customerId, ...agreementData }, '/api/agreement');
  },

  // POST /api/verify
  async verifyCustomer(customerId, actionData) {
    return _fetch('POST', '/customers/verify', { customerId, ...actionData }, '/api/verify');
  },

  // GET /api/devices
  async getDevices(searchQuery = '') {
    const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
    return _fetch('GET', `/devices${params}`, undefined, `/api/devices${params}`);
  },

  // POST /api/devices
  async addDevice(deviceData) {
    return _fetch('POST', '/devices', deviceData, '/api/devices');
  },

  // PUT /api/devices/:id
  async updateDevice(deviceId, deviceData) {
    return _fetch('PUT', `/devices/${deviceId}`, deviceData, `/api/devices?id=${deviceId}`);
  },

  // DELETE /api/devices/:id
  async deleteDevice(deviceId) {
    return _fetch('DELETE', `/devices/${deviceId}`, undefined, `/api/devices?id=${deviceId}`);
  },

  // POST /api/admin/create-booking
  async createMockBooking(customerId, deviceId, depositDays = 7) {
    return _fetch('POST', '/admin/create-booking', { customerId, deviceId, depositDays }, '/api/admin/create-booking');
  },

  // DELETE /api/admin/create-booking
  async removeMockBooking(customerId, deviceId) {
    return _fetch('DELETE', '/admin/create-booking', { customerId, deviceId }, '/api/admin/create-booking');
  },

  // POST /api/debug/reset
  async resetDatabase() {
    return _fetch('POST', '/debug/reset', {}, '/api/debug/reset');
  },

  // GET /api/reports/csv → returns raw CSV string via fetch
  exportCSV() {
    // Trigger download directly (same UX as before)
    fetch(`${BASE_URL}/reports/csv`)
      .then(resp => resp.text())
      .then(csv => {
        _emit('GET', '/api/reports/handovers-csv', 200, { message: 'CSV compiled from MySQL.', currencyFormat: 'INR' }, 0);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = `OPS_INR_Handovers_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(err => {
        _emit('GET', '/api/reports/handovers-csv', 500, null, 0, err);
        alert('CSV export failed: ' + err.message);
      });
  }
};

// Default export for convenience
export default db;
