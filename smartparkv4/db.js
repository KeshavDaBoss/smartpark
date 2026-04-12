const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./smartpark.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      slot TEXT,
      date TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_state (
      slot TEXT PRIMARY KEY,
      occupied INTEGER,
      distance INTEGER
    )
  `);
});

module.exports = db;
