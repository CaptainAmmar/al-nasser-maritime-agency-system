import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import multer from 'multer';
import fs from 'fs';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database initialization
const db = new Database('maritime.db');
db.pragma('journal_mode = WAL');

// Migration helper
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    console.log(`Added column ${column} to ${table}`);
  } catch (e) {
    // Ignore if column already exists
  }
};

// Apply migrations
addColumn('invoices', 'invoiceType', 'TEXT');
addColumn('invoices', 'im77Date', 'DATE');
addColumn('invoices', 'tr85Number', 'TEXT');
addColumn('invoices', 'tr85Date', 'DATE');
addColumn('invoices', 'depositNumber', 'TEXT');
addColumn('invoices', 'depositDate', 'DATE');
addColumn('invoices', 'localNumber', 'TEXT');
addColumn('invoices', 'localDate', 'DATE');
addColumn('invoices', 'exitRequestNumber', 'TEXT');
addColumn('invoices', 'cargoType', 'TEXT');
addColumn('invoices', 'grossWeight', 'REAL');
addColumn('invoices', 'unit', 'TEXT');
addColumn('invoices', 'shipId', 'INTEGER');
addColumn('invoices', 'headingId', 'INTEGER');
addColumn('customs_data', 'destination', 'TEXT');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT UNIQUE,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    jobTitle TEXT,
    permissions TEXT,
    status TEXT DEFAULT 'Offline',
    lastLogin DATETIME
  );

  CREATE TABLE IF NOT EXISTS ships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    agent TEXT,
    arrivalDate DATE,
    departureDate DATE,
    manifestNumber TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billNumber TEXT,
    date DATE,
    shipId INTEGER,
    cargoType TEXT,
    grossWeight REAL,
    netWeight REAL,
    packagesCount INTEGER,
    unit TEXT,
    FOREIGN KEY(shipId) REFERENCES ships(id)
  );

  CREATE TABLE IF NOT EXISTS headings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    heading TEXT,
    description TEXT,
    feeValue REAL
  );

  CREATE TABLE IF NOT EXISTS customs_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    code TEXT,
    declarationNumber TEXT,
    date DATE,
    sender TEXT,
    consignee TEXT,
    declarant TEXT,
    clearingAgent TEXT,
    shipId INTEGER,
    billId INTEGER,
    headingId INTEGER,
    fees REAL,
    cargoType TEXT,
    grossWeight REAL,
    netWeight REAL,
    packagesCount INTEGER,
    unit TEXT,
    totalValue REAL,
    destination TEXT,
    FOREIGN KEY(shipId) REFERENCES ships(id),
    FOREIGN KEY(billId) REFERENCES bills(id),
    FOREIGN KEY(headingId) REFERENCES headings(id)
  );

  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    declarationNumber TEXT,
    date DATE,
    tr85Number TEXT,
    tr85Date DATE,
    depositNumber TEXT,
    depositDate DATE,
    localNumber TEXT,
    localDate DATE,
    entryRequestNumber TEXT,
    sender TEXT,
    consignee TEXT,
    cargoOwner TEXT,
    cargoType TEXT,
    commercialRegister TEXT,
    origin TEXT,
    source TEXT,
    destination TEXT,
    declarant TEXT,
    clearingAgent TEXT,
    shipId INTEGER,
    headingId INTEGER,
    foreignInvoiceNumber TEXT,
    originCertificateNumber TEXT,
    billId INTEGER,
    itemsCount INTEGER,
    grossWeight REAL,
    netWeight REAL,
    packagesCount INTEGER,
    unit TEXT,
    FOREIGN KEY(shipId) REFERENCES ships(id),
    FOREIGN KEY(billId) REFERENCES bills(id),
    FOREIGN KEY(headingId) REFERENCES headings(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoiceType TEXT, -- ترانزيت، محلية
    invoiceNumber TEXT,
    date DATE,
    investorName TEXT,
    beneficiaryName TEXT,
    im77Number TEXT,
    im77Date DATE,
    tr85Number TEXT,
    tr85Date DATE,
    depositNumber TEXT,
    depositDate DATE,
    localNumber TEXT,
    localDate DATE,
    exitRequestNumber TEXT,
    cargoType TEXT,
    grossWeight REAL,
    netWeight REAL,
    packagesCount INTEGER,
    unit TEXT,
    shipId INTEGER,
    headingId INTEGER,
    FOREIGN KEY(shipId) REFERENCES ships(id),
    FOREIGN KEY(headingId) REFERENCES headings(id)
  );

  CREATE TABLE IF NOT EXISTS exits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    declarationType TEXT, -- استيراد، تصدير، ترانزيت
    code TEXT, -- IM4, IM42, IM44, TR85, TR82, EX, EX10
    declarationNumber TEXT,
    date DATE,
    sender TEXT,
    consignee TEXT,
    cargoType TEXT,
    origin TEXT,
    source TEXT,
    destination TEXT,
    declarant TEXT,
    clearingAgent TEXT,
    im77Number TEXT,
    im77Date DATE,
    headingId INTEGER,
    carsCount INTEGER,
    invoiceNumber TEXT,
    originCertificateNumber TEXT,
    shipId INTEGER,
    grossWeight REAL,
    netWeight REAL,
    packagesCount INTEGER,
    unit TEXT,
    FOREIGN KEY(headingId) REFERENCES headings(id),
    FOREIGN KEY(shipId) REFERENCES ships(id)
  );

  CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    carNumber TEXT UNIQUE,
    driverName TEXT,
    mobileNumber TEXT
  );

  CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    shipId INTEGER,
    billId INTEGER,
    carId INTEGER,
    netWeight REAL,
    packagesCount INTEGER,
    unit TEXT,
    employeeId INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(shipId) REFERENCES ships(id),
    FOREIGN KEY(billId) REFERENCES bills(id),
    FOREIGN KEY(carId) REFERENCES cars(id),
    FOREIGN KEY(employeeId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS deleted_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operationId INTEGER,
    type TEXT,
    shipName TEXT,
    billNumber TEXT,
    carNumber TEXT,
    netWeight REAL,
    packagesCount INTEGER,
    unit TEXT,
    employeeName TEXT,
    deletedBy TEXT,
    deletedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    address TEXT,
    phone TEXT,
    mobile TEXT,
    web TEXT,
    facebook TEXT,
    instagram TEXT,
    logo TEXT
  );

  CREATE TABLE IF NOT EXISTS app_instructions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER, -- NULL means all
    content TEXT NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent', -- sent, read
    reply TEXT,
    reply_date DATETIME,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    isRead INTEGER DEFAULT 0,
    userId INTEGER,
    FOREIGN KEY(userId) REFERENCES users(id)
  );
`);

// Insert default manager if not exists
const adminEmail = 'ammar.mouhamed.82@gmail.com';
const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
if (!existingAdmin) {
  db.prepare('INSERT INTO users (userId, name, email, password, jobTitle, permissions) VALUES (?, ?, ?, ?, ?, ?)')
    .run('ADM001', 'Ammar', adminEmail, '796796', 'مدير', 'الكل');
}

// Ensure the common admin credentials are also available if not already present
const commonAdmin = db.prepare('SELECT * FROM users WHERE userId = ?').get('100');
if (!commonAdmin) {
  db.prepare('INSERT OR IGNORE INTO users (userId, name, email, password, jobTitle, permissions) VALUES (?, ?, ?, ?, ?, ?)')
    .run('100', 'المدير العام', 'admin@maritime.com', '123456', 'مدير', 'الكل');
}

// Insert default settings if not exists
const settingsRow = db.prepare('SELECT count(*) as count FROM settings').get();
if (settingsRow.count === 0) {
  db.prepare('INSERT INTO settings (id, name, address, phone, mobile) VALUES (1, ?, ?, ?, ?)')
    .run('وكالة الناصر للملاحة البحرية', 'سوريا، طرطوس', '', '');
}

// API Routes

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Auth
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password);
  if (user) {
    db.prepare("UPDATE users SET status = 'Online', lastLogin = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);
    db.prepare('INSERT INTO notifications (message, userId) VALUES (?, ?)').run(`تسجيل دخول: ${user.name}`, user.id);
    res.json({ success: true, user });
  } else {
    res.status(401).json({ success: false, message: 'بيانات الاعتماد غير صالحة' });
  }
});

app.post('/api/logout', (req, res) => {
  const { userId } = req.body;
  if (userId) {
    db.prepare("UPDATE users SET status = 'Offline' WHERE id = ?").run(userId);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false });
  }
});

// Ships
app.get('/api/ships', (req, res) => res.json(db.prepare('SELECT * FROM ships').all()));
app.post('/api/ships', (req, res) => {
  const { name, agent, arrivalDate, departureDate, manifestNumber, status } = req.body;
  const result = db.prepare('INSERT INTO ships (name, agent, arrivalDate, departureDate, manifestNumber, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, agent, arrivalDate, departureDate, manifestNumber, status);
  res.json({ id: result.lastInsertRowid });
});
app.put('/api/ships/:id', (req, res) => {
  const { name, agent, arrivalDate, departureDate, manifestNumber, status } = req.body;
  db.prepare('UPDATE ships SET name = ?, agent = ?, arrivalDate = ?, departureDate = ?, manifestNumber = ?, status = ? WHERE id = ?')
    .run(name, agent, arrivalDate, departureDate, manifestNumber, status, req.params.id);
  res.json({ success: true });
});
app.delete('/api/ships/:id', (req, res) => {
  db.prepare('DELETE FROM ships WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Bills
app.get('/api/bills', (req, res) => res.json(db.prepare('SELECT b.*, s.name as shipName FROM bills b JOIN ships s ON b.shipId = s.id').all()));
app.post('/api/bills', (req, res) => {
  const { billNumber, date, shipId, cargoType, grossWeight, netWeight, packagesCount, unit } = req.body;
  const result = db.prepare('INSERT INTO bills (billNumber, date, shipId, cargoType, grossWeight, netWeight, packagesCount, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(billNumber, date, shipId, cargoType, grossWeight, netWeight, packagesCount, unit);
  res.json({ id: result.lastInsertRowid });
});
app.put('/api/bills/:id', (req, res) => {
  const { billNumber, date, shipId, cargoType, grossWeight, netWeight, packagesCount, unit } = req.body;
  db.prepare('UPDATE bills SET billNumber = ?, date = ?, shipId = ?, cargoType = ?, grossWeight = ?, netWeight = ?, packagesCount = ?, unit = ? WHERE id = ?')
    .run(billNumber, date, shipId, cargoType, grossWeight, netWeight, packagesCount, unit, req.params.id);
  res.json({ success: true });
});
app.delete('/api/bills/:id', (req, res) => {
  db.prepare('DELETE FROM bills WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Customs Data
app.get('/api/customs', (req, res) => res.json(db.prepare('SELECT c.*, s.name as shipName, b.billNumber as billNumber, h.heading as headingName FROM customs_data c LEFT JOIN ships s ON c.shipId = s.id LEFT JOIN bills b ON c.billId = b.id LEFT JOIN headings h ON c.headingId = h.id').all()));
app.post('/api/customs', (req, res) => {
  const { type, code, declarationNumber, date, sender, consignee, declarant, clearingAgent, destination, shipId, billId, headingId, fees, cargoType, grossWeight, netWeight, packagesCount, unit, totalValue } = req.body;
  const result = db.prepare('INSERT INTO customs_data (type, code, declarationNumber, date, sender, consignee, declarant, clearingAgent, destination, shipId, billId, headingId, fees, cargoType, grossWeight, netWeight, packagesCount, unit, totalValue) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(type, code, declarationNumber, date, sender, consignee, declarant, clearingAgent, destination, shipId, billId, headingId, fees, cargoType, grossWeight, netWeight, packagesCount, unit, totalValue);
  res.json({ id: result.lastInsertRowid });
});
app.put('/api/customs/:id', (req, res) => {
  const { type, code, declarationNumber, date, sender, consignee, declarant, clearingAgent, destination, shipId, billId, headingId, fees, cargoType, grossWeight, netWeight, packagesCount, unit, totalValue } = req.body;
  db.prepare('UPDATE customs_data SET type=?, code=?, declarationNumber=?, date=?, sender=?, consignee=?, declarant=?, clearingAgent=?, destination=?, shipId=?, billId=?, headingId=?, fees=?, cargoType=?, grossWeight=?, netWeight=?, packagesCount=?, unit=?, totalValue=? WHERE id=?')
    .run(type, code, declarationNumber, date, sender, consignee, declarant, clearingAgent, destination, shipId, billId, headingId, fees, cargoType, grossWeight, netWeight, packagesCount, unit, totalValue, req.params.id);
  res.json({ success: true });
});
app.delete('/api/customs/:id', (req, res) => {
  db.prepare('DELETE FROM customs_data WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Deposits (IM77)
app.get('/api/deposits', (req, res) => res.json(db.prepare('SELECT d.*, s.name as shipName, b.billNumber FROM deposits d LEFT JOIN ships s ON d.shipId = s.id LEFT JOIN bills b ON d.billId = b.id').all()));
app.post('/api/deposits', (req, res) => {
  const { declarationNumber, date, tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, entryRequestNumber, sender, consignee, cargoOwner, cargoType, commercialRegister, origin, source, destination, declarant, clearingAgent, shipId, headingId, foreignInvoiceNumber, originCertificateNumber, billId, itemsCount, grossWeight, netWeight, packagesCount, unit } = req.body;
  const result = db.prepare('INSERT INTO deposits (declarationNumber, date, tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, entryRequestNumber, sender, consignee, cargoOwner, cargoType, commercialRegister, origin, source, destination, declarant, clearingAgent, shipId, headingId, foreignInvoiceNumber, originCertificateNumber, billId, itemsCount, grossWeight, netWeight, packagesCount, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(declarationNumber, date, tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, entryRequestNumber, sender, consignee, cargoOwner, cargoType, commercialRegister, origin, source, destination, declarant, clearingAgent, shipId, headingId, foreignInvoiceNumber, originCertificateNumber, billId, itemsCount, grossWeight, netWeight, packagesCount, unit);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/deposits/:id', (req, res) => {
    const { declarationNumber, date, tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, entryRequestNumber, sender, consignee, cargoOwner, cargoType, commercialRegister, origin, source, destination, declarant, clearingAgent, shipId, headingId, foreignInvoiceNumber, originCertificateNumber, billId, itemsCount, grossWeight, netWeight, packagesCount, unit } = req.body;
    db.prepare('UPDATE deposits SET declarationNumber=?, date=?, tr85Number=?, tr85Date=?, depositNumber=?, depositDate=?, localNumber=?, localDate=?, entryRequestNumber=?, sender=?, consignee=?, cargoOwner=?, cargoType=?, commercialRegister=?, origin=?, source=?, destination=?, declarant=?, clearingAgent=?, shipId=?, headingId=?, foreignInvoiceNumber=?, originCertificateNumber=?, billId=?, itemsCount=?, grossWeight=?, netWeight=?, packagesCount=?, unit=? WHERE id=?')
      .run(declarationNumber, date, tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, entryRequestNumber, sender, consignee, cargoOwner, cargoType, commercialRegister, origin, source, destination, declarant, clearingAgent, shipId, headingId, foreignInvoiceNumber, originCertificateNumber, billId, itemsCount, grossWeight, netWeight, packagesCount, unit, req.params.id);
    res.json({ success: true });
});

app.delete('/api/deposits/:id', (req, res) => {
    db.prepare('DELETE FROM deposits WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// Invoices
app.get('/api/invoices', (req, res) => res.json(db.prepare('SELECT i.*, s.name as shipName, h.heading as headingName FROM invoices i LEFT JOIN ships s ON i.shipId = s.id LEFT JOIN headings h ON i.headingId = h.id').all()));
app.post('/api/invoices', (req, res) => {
  const { 
    invoiceType, invoiceNumber, date, investorName, beneficiaryName, im77Number, im77Date, 
    tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, 
    exitRequestNumber, cargoType, grossWeight, netWeight, packagesCount, unit, 
    shipId, headingId 
  } = req.body;
  const result = db.prepare(`
    INSERT INTO invoices (
      invoiceType, invoiceNumber, date, investorName, beneficiaryName, im77Number, im77Date, 
      tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, 
      exitRequestNumber, cargoType, grossWeight, netWeight, packagesCount, unit, shipId, headingId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoiceType, invoiceNumber, date, investorName, beneficiaryName, im77Number, im77Date, 
    tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, 
    exitRequestNumber, cargoType, grossWeight, netWeight, packagesCount, unit, shipId, headingId
  );
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/invoices/:id', (req, res) => {
    const { 
      invoiceType, invoiceNumber, date, investorName, beneficiaryName, im77Number, im77Date, 
      tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, 
      exitRequestNumber, cargoType, grossWeight, netWeight, packagesCount, unit, shipId, headingId 
    } = req.body;
    db.prepare(`
      UPDATE invoices SET 
        invoiceType=?, invoiceNumber=?, date=?, investorName=?, beneficiaryName=?, im77Number=?, im77Date=?, 
        tr85Number=?, tr85Date=?, depositNumber=?, depositDate=?, localNumber=?, localDate=?, 
        exitRequestNumber=?, cargoType=?, grossWeight=?, netWeight=?, packagesCount=?, unit=?, shipId=?, headingId=?
      WHERE id=?
    `).run(
      invoiceType, invoiceNumber, date, investorName, beneficiaryName, im77Number, im77Date, 
      tr85Number, tr85Date, depositNumber, depositDate, localNumber, localDate, 
      exitRequestNumber, cargoType, grossWeight, netWeight, packagesCount, unit, shipId, headingId, req.params.id
    );
    res.json({ success: true });
});

app.delete('/api/invoices/:id', (req, res) => {
    db.prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// Exits (Withdrawals)
app.get('/api/exits', (req, res) => res.json(db.prepare('SELECT e.*, s.name as shipName, h.heading as headingName FROM exits e LEFT JOIN ships s ON e.shipId = s.id LEFT JOIN headings h ON e.headingId = h.id').all()));
app.post('/api/exits', (req, res) => {
  const { 
    declarationType, code, declarationNumber, date, sender, consignee, 
    cargoType, origin, source, destination, declarant, clearingAgent, 
    im77Number, im77Date, headingId, carsCount, invoiceNumber, 
    originCertificateNumber, shipId, grossWeight, netWeight, packagesCount, unit 
  } = req.body;
  const result = db.prepare(`
    INSERT INTO exits (
      declarationType, code, declarationNumber, date, sender, consignee, 
      cargoType, origin, source, destination, declarant, clearingAgent, 
      im77Number, im77Date, headingId, carsCount, invoiceNumber, 
      originCertificateNumber, shipId, grossWeight, netWeight, packagesCount, unit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    declarationType, code, declarationNumber, date, sender, consignee, 
    cargoType, origin, source, destination, declarant, clearingAgent, 
    im77Number, im77Date, headingId, carsCount, invoiceNumber, 
    originCertificateNumber, shipId, grossWeight, netWeight, packagesCount, unit
  );
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/exits/:id', (req, res) => {
    const { 
        declarationType, code, declarationNumber, date, sender, consignee, 
        cargoType, origin, source, destination, declarant, clearingAgent, 
        im77Number, im77Date, headingId, carsCount, invoiceNumber, 
        originCertificateNumber, shipId, grossWeight, netWeight, packagesCount, unit 
    } = req.body;
    db.prepare(`
        UPDATE exits SET 
            declarationType=?, code=?, declarationNumber=?, date=?, sender=?, consignee=?, 
            cargoType=?, origin=?, source=?, destination=?, declarant=?, clearingAgent=?, 
            im77Number=?, im77Date=?, headingId=?, carsCount=?, invoiceNumber=?, 
            originCertificateNumber=?, shipId=?, grossWeight=?, netWeight=?, packagesCount=?, unit=?
        WHERE id=?
    `).run(
        declarationType, code, declarationNumber, date, sender, consignee, 
        cargoType, origin, source, destination, declarant, clearingAgent, 
        im77Number, im77Date, headingId, carsCount, invoiceNumber, 
        originCertificateNumber, shipId, grossWeight, netWeight, packagesCount, unit, req.params.id
    );
    res.json({ success: true });
});

app.delete('/api/exits/:id', (req, res) => {
    db.prepare('DELETE FROM exits WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// Headings
app.get('/api/headings', (req, res) => res.json(db.prepare('SELECT * FROM headings').all()));
app.post('/api/headings', (req, res) => {
  const { heading, description, feeValue } = req.body;
  const result = db.prepare('INSERT INTO headings (heading, description, feeValue) VALUES (?, ?, ?)')
    .run(heading, description, feeValue);
  res.json({ id: result.lastInsertRowid });
});
app.delete('/api/headings/:id', (req, res) => {
    db.prepare('DELETE FROM headings WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// Cars
app.get('/api/cars', (req, res) => res.json(db.prepare('SELECT * FROM cars').all()));
app.post('/api/cars', (req, res) => {
  const { carNumber, driverName, mobileNumber } = req.body;
  const result = db.prepare('INSERT INTO cars (carNumber, driverName, mobileNumber) VALUES (?, ?, ?)')
    .run(carNumber, driverName, mobileNumber);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/cars/:id', (req, res) => {
  const { carNumber, driverName, mobileNumber } = req.body;
  db.prepare('UPDATE cars SET carNumber = ?, driverName = ?, mobileNumber = ? WHERE id = ?')
    .run(carNumber, driverName, mobileNumber, req.params.id);
  res.json({ success: true });
});

app.delete('/api/cars/:id', (req, res) => {
  db.prepare('DELETE FROM cars WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/cars/bulk', (req, res) => {
  const cars = req.body;
  if (!Array.isArray(cars)) return res.status(400).json({ success: false });

  const insert = db.prepare('INSERT INTO cars (carNumber, driverName, mobileNumber) VALUES (?, ?, ?)');
  const check = db.prepare('SELECT id FROM cars WHERE carNumber = ?');
  
  let addedCount = 0;
  const transaction = db.transaction((data) => {
    for (const car of data) {
      if (!car.carNumber) continue;
      const existing = check.get(car.carNumber);
      if (!existing) {
        insert.run(car.carNumber, car.driverName || '', car.mobileNumber || '');
        addedCount++;
      }
    }
  });

  transaction(cars);
  res.json({ success: true, addedCount });
});

// Operations
app.get('/api/operations', (req, res) => res.json(db.prepare('SELECT o.*, s.name as shipName, b.billNumber, c.carNumber, u.name as employeeName FROM operations o JOIN ships s ON o.shipId = s.id JOIN bills b ON o.billId = b.id JOIN cars c ON o.carId = c.id JOIN users u ON o.employeeId = u.id').all()));
app.post('/api/operations', (req, res) => {
  const { type, shipId, billId, carId, netWeight, packagesCount, unit, employeeId } = req.body;
  const result = db.prepare('INSERT INTO operations (type, shipId, billId, carId, netWeight, packagesCount, unit, employeeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(type, shipId, billId, carId, netWeight, packagesCount, unit, employeeId);
  res.json({ id: result.lastInsertRowid });
});
app.delete('/api/operations/:id', (req, res) => {
  const { deletedBy } = req.query;
  const op = db.prepare('SELECT o.*, s.name as shipName, b.billNumber, c.carNumber, u.name as employeeName FROM operations o JOIN ships s ON o.shipId = s.id JOIN bills b ON o.billId = b.id JOIN cars c ON o.carId = c.id JOIN users u ON o.employeeId = u.id WHERE o.id = ?').get(req.params.id);
  if (op) {
     db.prepare('INSERT INTO deleted_operations (operationId, type, shipName, billNumber, carNumber, netWeight, packagesCount, unit, employeeName, deletedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
       .run(op.id, op.type, op.shipName, op.billNumber, op.carNumber, op.netWeight, op.packagesCount, op.unit, op.employeeName, deletedBy);
     db.prepare('DELETE FROM operations WHERE id = ?').run(req.params.id);
     res.json({ success: true });
  } else {
     res.status(404).json({ success: false });
  }
});

app.put('/api/operations/:id', (req, res) => {
  const { type, shipId, billId, carId, netWeight, packagesCount, unit } = req.body;
  db.prepare('UPDATE operations SET type = ?, shipId = ?, billId = ?, carId = ?, netWeight = ?, packagesCount = ?, unit = ? WHERE id = ?')
    .run(type, shipId, billId, carId, netWeight, packagesCount, unit, req.params.id);
  res.json({ success: true });
});

// Users/Employees
app.get('/api/users', (req, res) => res.json(db.prepare('SELECT id, userId, name, email, jobTitle, permissions, status, lastLogin FROM users').all()));
app.post('/api/users', (req, res) => {
    const { userId, name, email, password, jobTitle, permissions } = req.body;
    const result = db.prepare('INSERT INTO users (userId, name, email, password, jobTitle, permissions) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, name, email, password, jobTitle, permissions);
    res.json({ id: result.lastInsertRowid });
});
app.put('/api/users/:id', (req, res) => {
    const { name, email, password, jobTitle, permissions } = req.body;
    if (password) {
        db.prepare('UPDATE users SET name = ?, email = ?, password = ?, jobTitle = ?, permissions = ? WHERE id = ?')
          .run(name, email, password, jobTitle, permissions, req.params.id);
    } else {
        db.prepare('UPDATE users SET name = ?, email = ?, jobTitle = ?, permissions = ? WHERE id = ?')
          .run(name, email, jobTitle, permissions, req.params.id);
    }
    res.json({ success: true });
});
app.delete('/api/users/:id', (req, res) => {
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// Deleted Logs
app.get('/api/deleted-logs', (req, res) => res.json(db.prepare('SELECT * FROM deleted_operations ORDER BY deletedAt DESC').all()));

// Restore Operation
app.post('/api/restore-operation/:id', (req, res) => {
    const log = db.prepare('SELECT * FROM deleted_operations WHERE id = ?').get(req.params.id);
    if (!log) return res.status(404).json({ success: false });
    
    const ship = db.prepare('SELECT id FROM ships WHERE name = ?').get(log.shipName);
    const bill = db.prepare('SELECT id FROM bills WHERE billNumber = ?').get(log.billNumber);
    const car = db.prepare('SELECT id FROM cars WHERE carNumber = ?').get(log.carNumber);
    const user = db.prepare('SELECT id FROM users WHERE name = ?').get(log.employeeName);

    if (ship && bill && car && user) {
        db.prepare('INSERT INTO operations (type, shipId, billId, carId, netWeight, packagesCount, unit, employeeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(log.type, ship.id, bill.id, car.id, log.netWeight, log.packagesCount, log.unit, user.id);
        db.prepare('DELETE FROM deleted_operations WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } else {
        res.status(400).json({ success: false, message: 'تعذر العثور على البيانات المرتبطة (الباخرة أو البوليصة أو السائق أو الموظف)' });
    }
});

// Settings
app.get('/api/settings', (req, res) => res.json(db.prepare('SELECT * FROM settings WHERE id = 1').get()));
app.post('/api/settings', (req, res) => {
  const { name, address, phone, mobile, web, facebook, instagram, logo } = req.body;
  db.prepare('UPDATE settings SET name = ?, address = ?, phone = ?, mobile = ?, web = ?, facebook = ?, instagram = ?, logo = ? WHERE id = 1')
    .run(name, address, phone, mobile, web, facebook, instagram, logo);
  res.json({ success: true });
});

// Restore endpoint for Excel backup
app.post('/api/restore', (req, res) => {
  const { table, records } = req.body;
  if (!table || !Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid data' });
  }

  // Map sheet names to table names if necessary
  const tableMapping: Record<string, string> = {
    'customs': 'customs_data',
    'freezone': 'freezone_data', // Note: Check if this table exists. It was in the endpoints list.
  };

  const targetTable = tableMapping[table] || table;

  try {
    // Start transaction
    const transaction = db.transaction((data) => {
      // Clear table
      db.prepare(`DELETE FROM ${targetTable}`).run();

      // Get columns from first record
      const columns = Object.keys(data[0]).filter(col => col !== 'id'); // Exclude auto-increment ID if present
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO ${targetTable} (${columns.join(', ')}) VALUES (${placeholders})`;
      const insert = db.prepare(sql);

      for (const record of data) {
        const values = columns.map(col => record[col]);
        insert.run(...values);
      }
    });

    transaction(records);
    res.json({ success: true, message: `Successfully restored ${records.length} records to ${targetTable}` });
  } catch (error: any) {
    console.error(`Restore error for ${targetTable}:`, error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Instructions API
app.get('/api/instructions', (req, res) => {
  const { user_id } = req.query;
  const user = db.prepare('SELECT jobTitle FROM users WHERE id = ?').get(user_id);
  
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.jobTitle === 'مدير') {
    res.json(db.prepare(`
      SELECT i.*, u.name as recipient_name, s.name as sender_name 
      FROM app_instructions i
      LEFT JOIN users u ON i.recipient_id = u.id
      LEFT JOIN users s ON i.sender_id = s.id
      ORDER BY i.date DESC
    `).all());
  } else {
    res.json(db.prepare(`
      SELECT i.*, s.name as sender_name 
      FROM app_instructions i
      LEFT JOIN users s ON i.sender_id = s.id
      WHERE i.recipient_id = ? OR i.recipient_id IS NULL
      ORDER BY i.date DESC
    `).all(user_id));
  }
});

app.post('/api/instructions', (req, res) => {
  const { sender_id, recipient_id, content } = req.body;
  const info = db.prepare('INSERT INTO app_instructions (sender_id, recipient_id, content) VALUES (?, ?, ?)').run(sender_id, recipient_id || null, content);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/instructions/read', (req, res) => {
  const { id } = req.body;
  db.prepare("UPDATE app_instructions SET status = 'read' WHERE id = ?").run(id);
  res.json({ success: true });
});

app.post('/api/instructions/reply', (req, res) => {
  const { id, reply } = req.body;
  db.prepare('UPDATE app_instructions SET reply = ?, reply_date = CURRENT_TIMESTAMP WHERE id = ?').run(reply, id);
  res.json({ success: true });
});

app.delete('/api/instructions/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM app_instructions WHERE id = ?').run(id);
  res.json({ success: true });
});

// Notifications
app.get('/api/notifications', (req, res) => res.json(db.prepare('SELECT * FROM notifications ORDER BY timestamp DESC').all()));
app.post('/api/notifications/read', (req, res) => {
    db.prepare('UPDATE notifications SET isRead = 1').run();
    res.json({ success: true });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
});

startServer();
