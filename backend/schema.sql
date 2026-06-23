
-- One Point Solutions - MySQL Schema & Seed Data
-- Run this file once to initialise the database

CREATE DATABASE IF NOT EXISTS onesol_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE onesol_db;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS devices (
  id            VARCHAR(40) PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  serialNumber  VARCHAR(100) NOT NULL UNIQUE,
  status        ENUM('available','rented','repair') NOT NULL DEFAULT 'available',
  `condition`   ENUM('excellent','good','damaged') NOT NULL DEFAULT 'excellent',
  rentPerDay    INT NOT NULL DEFAULT 0,
  deposit       INT NOT NULL DEFAULT 0,
  repairCost    INT NOT NULL DEFAULT 0,
  rentDays      INT NOT NULL DEFAULT 7,
  createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id               VARCHAR(40) PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  phone            VARCHAR(30)  NOT NULL,
  password         VARCHAR(255) NOT NULL DEFAULT 'password123',
  address          TEXT,
  idProofName      VARCHAR(255) DEFAULT '',
  status           ENUM('pending_upload','verification_in_progress','approved','rejected') NOT NULL DEFAULT 'pending_upload',
  rejectionReason  TEXT,
  riskFlags        JSON,
  signature        VARCHAR(255) DEFAULT '',
  assignedStaff    VARCHAR(255) DEFAULT '',
  `timestamp`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id           VARCHAR(40) PRIMARY KEY,
  customerId   VARCHAR(40) NOT NULL,
  deviceId     VARCHAR(40) NOT NULL,
  startDate    DATE NOT NULL,
  endDate      DATE NOT NULL,
  deposit      INT NOT NULL DEFAULT 0,
  returnStatus ENUM('on_time','overdue','returned') NOT NULL DEFAULT 'on_time',
  createdAt    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (deviceId)   REFERENCES devices(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(60) PRIMARY KEY,
  customerId  VARCHAR(40) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  operator    VARCHAR(255),
  notes       TEXT,
  `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

-- ============================================================
-- SEED DATA  (insert only if tables are empty)
-- ============================================================

INSERT IGNORE INTO devices (id, name, serialNumber, status, `condition`, rentPerDay, deposit, repairCost, rentDays) VALUES
  ('dev_001', 'MacBook Pro 16" M3 Max',          'OPS-MBP-9981', 'available', 'excellent', 2500,  15000, 0, 7),
  ('dev_002', 'Sony FX3 Cinema Camera',           'OPS-SO-4412',  'available', 'excellent', 3500,  25000, 0, 7),
  ('dev_003', 'Epson Pro Cinema 4K Projector',    'OPS-EP-8772',  'available', 'good',      1500,  10000, 0, 7),
  ('dev_004', 'L-Acoustics Sound Console',        'OPS-LA-1090',  'available', 'good',      5000,  35000, 0, 7),
  ('dev_005', 'Dell Precision 7780 Workstation',  'OPS-DE-5531',  'repair',    'damaged',   2200,  12000, 75000, 7),
  ('dev_006', 'iPad Pro 12.9" M2 Cellular',       'OPS-IP-3001',  'available', 'excellent', 800,   5000,  0, 7),
  ('dev_007', 'DJI Inspire 3 Drone Cinema Kit',   'OPS-DJ-1249',  'available', 'excellent', 4000,  30000, 0, 7),
  ('dev_008', 'Shure Axient Digital Mic System',  'OPS-SH-8821',  'available', 'excellent', 1800,  12000, 0, 7),
  ('dev_009', 'RED Komodo 6K Cinema Camera',      'OPS-RE-0091',  'available', 'excellent', 5000,  35000, 0, 7);

INSERT IGNORE INTO customers (id, name, email, phone, address, idProofName, status, rejectionReason, riskFlags, signature, assignedStaff, `timestamp`) VALUES
  ('cust_002', 'Bob Smith',     'bob@enterprise.org',   '9811223344',   '',                                                            'pan_card_bob.png',          'verification_in_progress', '',                                                                              '["SYSTEM: Missing Physical Address"]',                        '',               'Michael Vance',  '2026-06-14 09:15:00'),
  ('cust_003', 'Charlie Davis', 'charlie@outlook.com',  '12345',        'Flat 405, Prestige Enclave, Whitefield, Bengaluru - 560066', '',                          'pending_upload',           '',                                                                              '["SYSTEM: Missing ID Proof","SYSTEM: Invalid Phone Format"]', '',               'Sarah Jenkins',  '2026-06-15 01:22:00'),
  ('cust_004', 'Diana Prince',  'diana@themiscira.net', '+91 8899889988','Green Park Extension, New Delhi - 110016',                  'indian_passport_diana.jpg', 'rejected',                 'ID document was blurry. Please upload a high-resolution Aadhaar Card or Passport scan.', '[]',                                                     '',               'Michael Vance',  '2026-06-12 11:04:00'),
  ('cust_005', 'Rahul Sharma',  'rahul@gmail.com',      '9876543210',   'A-102, Shanti Vihar, Mumbai - 400001',                        'adhaar_rahul.png',          'approved',                 '',                                                                              '[]',                                                                            'Rahul Sharma',   'Sarah Jenkins',  '2026-06-16 10:00:00'),
  ('cust_006', 'Aisha Khan',     'aisha@outlook.com',    '9812345678',   'Plot 45, Jubilee Hills, Hyderabad - 500033',                  'passport_aisha.jpg',        'verification_in_progress', '',                                                                              '[]',                                                                            '',               'Sarah Jenkins',  '2026-06-16 11:30:00');

INSERT IGNORE INTO bookings (id, customerId, deviceId, startDate, endDate, deposit, returnStatus) VALUES
  ('book_003', 'cust_002', 'dev_005', '2026-06-15', '2026-06-22', 12000, 'on_time');

INSERT IGNORE INTO audit_logs (id, customerId, action, operator, notes, `timestamp`) VALUES
  ('log_004', 'cust_002', 'KYC_SUBMITTED',    'Bob Smith',     'KYC profile created. Flagged for missing address.',                      '2026-06-14 09:15:00'),
  ('log_005', 'cust_004', 'KYC_SUBMITTED',    'Diana Prince',  'Passport ID scan uploaded.',                                             '2026-06-12 11:04:00'),
  ('log_006', 'cust_004', 'KYC_REJECTED',     'Michael Vance', 'Rejected: Blurry scan.',                                                 '2026-06-12 15:40:00');
