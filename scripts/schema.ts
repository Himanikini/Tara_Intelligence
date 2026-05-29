import { Pool } from 'pg';

// ── CREATE SCHEMA ─────────────────────────────────────────────────────────────
export const createSchema = `
  CREATE SCHEMA IF NOT EXISTS tara_intelligent;
`;

// ── FUNDS ─────────────────────────────────────────────────────────────────────
export const createFundsTable = `
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
  );
`;

// ── HOLDINGS ──────────────────────────────────────────────────────────────────
export const createHoldingsTable = `
  CREATE TABLE IF NOT EXISTS tara_intelligent.holdings (
    id            SERIAL PRIMARY KEY,
    fund_id       TEXT REFERENCES tara_intelligent.funds(fund_id),
    fund_name     TEXT,
    units         NUMERIC,
    purchase_nav  NUMERIC,
    purchase_date DATE,
    folio_no      TEXT
  );
`;

// ── FUND TRANSACTIONS ─────────────────────────────────────────────────────────
export const createFundTransactionsTable = `
  CREATE TABLE IF NOT EXISTS tara_intelligent.fund_transactions (
    txn_id    TEXT PRIMARY KEY,
    fund_id   TEXT REFERENCES tara_intelligent.funds(fund_id),
    folio_no  TEXT,
    txn_type  TEXT,
    units     NUMERIC,
    nav       NUMERIC,
    amount    NUMERIC,
    txn_date  DATE
  );
`;

//  BANK TRANSACTIONS ─────────────────────────────────────────────────────────
export const createBankTransactionsTable = `
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
  );
`;

// ── HEALTH TRANSACTIONS ───────────────────────────────────────────────────────
export const createHealthTransactionsTable = `
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
  );
`;

export const createIndexes = `
  CREATE INDEX IF NOT EXISTS idx_bank_date
    ON tara_intelligent.bank_transactions(txn_date);

  CREATE INDEX IF NOT EXISTS idx_bank_category
    ON tara_intelligent.bank_transactions(category);

  CREATE INDEX IF NOT EXISTS idx_health_date
    ON tara_intelligent.health_transactions(txn_date);

  CREATE INDEX IF NOT EXISTS idx_health_subcategory
    ON tara_intelligent.health_transactions(sub_category);

  CREATE INDEX IF NOT EXISTS idx_fund_txn_id
    ON tara_intelligent.fund_transactions(fund_id);

  CREATE INDEX IF NOT EXISTS idx_fund_txn_date
    ON tara_intelligent.fund_transactions(txn_date);
`;


export async function ensureSchema(pool: Pool) {
 
  await pool.query(createSchema);
  await pool.query(createFundsTable);
  await pool.query(createHoldingsTable);
  await pool.query(createFundTransactionsTable);
  await pool.query(createBankTransactionsTable);
  await pool.query(createHealthTransactionsTable);
  await pool.query(createIndexes);

  console.log(' All 5 tables and indexes ready — tara_intelligent schema');
}