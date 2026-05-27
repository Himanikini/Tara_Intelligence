import { Pool } from 'pg';

export const createFundsTable = `
CREATE TABLE IF NOT EXISTS funds (
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

export const createHoldingsTable = `
CREATE TABLE IF NOT EXISTS holdings (
  id            SERIAL PRIMARY KEY,
  fund_id       TEXT REFERENCES funds(fund_id),
  fund_name     TEXT,
  units         NUMERIC,
  purchase_nav  NUMERIC,
  purchase_date DATE,
  folio_no      TEXT
);
`;

export const createTransactionsTable = `
CREATE TABLE IF NOT EXISTS transactions (
  txn_id    TEXT PRIMARY KEY,
  fund_id   TEXT REFERENCES funds(fund_id),
  folio_no  TEXT,
  txn_type  TEXT,
  units     NUMERIC,
  nav       NUMERIC,
  amount    NUMERIC,
  txn_date  DATE
);
`;

export async function ensureSchema(pool: Pool) {
  await pool.query(createFundsTable);
  await pool.query(createHoldingsTable);
  await pool.query(createTransactionsTable);
}
