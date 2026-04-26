const Database = require('better-sqlite3');
const db = new Database('maritime.db');
const tableInfo = db.prepare('PRAGMA table_info(instructions)').all();
console.log(JSON.stringify(tableInfo, null, 2));
db.close();
