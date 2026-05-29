import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host:                    process.env.DB_HOST     || 'localhost',
  port:                    Number(process.env.DB_PORT) || 5432,
  database:                process.env.DB_NAME     || 'tara_intelligence',
  user:                    process.env.DB_USER     || 'postgres',
  password:                process.env.DB_PASSWORD || 'himani18',
  max:                     10,
  idleTimeoutMillis:       30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log(' PostgreSQL connected → tara_intelligence');
});

pool.on('error', (err) => {
  console.error(' Unexpected DB client error:', err.message);
});

export async function initDB() {
  const client = await pool.connect();
  try {
    console.log(' Checking database schema...');

    await client.query('CREATE SCHEMA IF NOT EXISTS tara_intelligent');

    await client.query(`
      CREATE TABLE IF NOT EXISTS tara_intelligent.funds (
        fund_id       TEXT PRIMARY KEY,
        fund_name     TEXT,
        category      TEXT,
        amc           TEXT,
        fund_manager  TEXT,
        benchmark     TEXT,
        expense_ratio NUMERIC,
        aum_cr        NUMERIC,
        current_nav   NUMERIC,
        nav_date      DATE,
        launch_date   DATE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tara_intelligent.holdings (
        id            SERIAL PRIMARY KEY,
        fund_id       TEXT REFERENCES tara_intelligent.funds(fund_id),
        fund_name     TEXT,
        units         NUMERIC,
        purchase_nav  NUMERIC,
        purchase_date DATE,
        folio_no      TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tara_intelligent.fund_transactions (
        txn_id    TEXT PRIMARY KEY,
        fund_id   TEXT REFERENCES tara_intelligent.funds(fund_id),
        folio_no  TEXT,
        txn_type  TEXT,
        units     NUMERIC,
        nav       NUMERIC,
        amount    NUMERIC,
        txn_date  DATE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tara_intelligent.bank_transactions (
        id         BIGSERIAL PRIMARY KEY,
        txn_id     TEXT UNIQUE NOT NULL,
        txn_date   DATE NOT NULL,
        merchant   TEXT NOT NULL,
        category   TEXT NOT NULL,
        amount     NUMERIC(12,2) NOT NULL,
        currency   CHAR(3) DEFAULT 'INR',
        memo       TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS tara_intelligent.health_transactions (
        id           BIGSERIAL PRIMARY KEY,
        txn_id       TEXT UNIQUE NOT NULL,
        txn_date     DATE NOT NULL,
        merchant     TEXT NOT NULL,
        sub_category TEXT DEFAULT 'general',
        amount       NUMERIC(12,2) NOT NULL,
        currency     CHAR(3) DEFAULT 'INR',
        memo         TEXT,
        bank_txn_id  TEXT REFERENCES tara_intelligent.bank_transactions(txn_id)
                     ON DELETE SET NULL,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bank_date
        ON tara_intelligent.bank_transactions(txn_date);
      CREATE INDEX IF NOT EXISTS idx_bank_category
        ON tara_intelligent.bank_transactions(category);
      CREATE INDEX IF NOT EXISTS idx_health_date
        ON tara_intelligent.health_transactions(txn_date);
      CREATE INDEX IF NOT EXISTS idx_health_subcategory
        ON tara_intelligent.health_transactions(sub_category);
      CREATE INDEX IF NOT EXISTS idx_fund_txn_fund_id
        ON tara_intelligent.fund_transactions(fund_id);
      CREATE INDEX IF NOT EXISTS idx_fund_txn_date
        ON tara_intelligent.fund_transactions(txn_date);
    `);

    console.log(' All 5 tables ready — existing data safe');

  } catch (err: any) {
    console.error(' DB init failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function closeDB() {
  await pool.end();
  console.log(' Database pool closed');
}

process.on('SIGINT',  async () => { await closeDB(); process.exit(0); });
process.on('SIGTERM', async () => { await closeDB(); process.exit(0); });