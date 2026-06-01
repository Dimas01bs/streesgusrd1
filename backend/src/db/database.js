const { Pool } = require("pg");
const { env } = require("../config/env");

let pool;

async function initializeDatabase() {
  if (pool) {
    return pool;
  }

  pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sleep_date DATE NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      sleep_hours REAL NOT NULL,
      sleep_quality_score REAL NOT NULL,
      daily_screen_time_hours REAL NOT NULL,
      phone_usage_before_sleep_minutes INTEGER NOT NULL,
      notes TEXT,
      stress_score INTEGER NOT NULL,
      stress_level TEXT NOT NULL,
      confidence REAL NOT NULL,
      recommendations TEXT NOT NULL,
      model_provider TEXT NOT NULL,
      model_version TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_predictions_user_id
      ON predictions(user_id);

    CREATE INDEX IF NOT EXISTS idx_predictions_created_at
      ON predictions(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_predictions_stress_level
      ON predictions(stress_level);
  `);

  return pool;
}

async function getDatabase() {
  if (!pool) {
    await initializeDatabase();
  }

  return pool;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};
