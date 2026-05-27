// scripts/ingest.ts
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.ts';
import { ensureSchema } from './schema.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runQuery(q: string, params: any[] = []) {
  const client = await pool.connect();
  try {
    return await client.query(q, params);
  } finally {
    client.release();
  }
}

export async function runIngestion() {
  const dataDir = path.resolve(__dirname, '..', 'data');

  const funds = JSON.parse(fs.readFileSync(path.join(dataDir, 'funds.json'), 'utf-8'));
  const holdings = JSON.parse(fs.readFileSync(path.join(dataDir, 'holdings.json'), 'utf-8'));
  const txns = JSON.parse(fs.readFileSync(path.join(dataDir, 'transactions.json'), 'utf-8'));

  await ensureSchema(pool);
  console.log('Tables created');

  for (const f of funds) {
    await runQuery(
      `INSERT INTO funds (fund_id, fund_name, category, amc, fund_manager, benchmark, expense_ratio, aum_cr, current_nav, nav_date, launch_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (fund_id) DO UPDATE SET
         fund_name=EXCLUDED.fund_name,
         category=EXCLUDED.category,
         amc=EXCLUDED.amc,
         fund_manager=EXCLUDED.fund_manager,
         benchmark=EXCLUDED.benchmark,
         expense_ratio=EXCLUDED.expense_ratio,
         aum_cr=EXCLUDED.aum_cr,
         current_nav=EXCLUDED.current_nav,
         nav_date=EXCLUDED.nav_date,
         launch_date=EXCLUDED.launch_date`,
      [
        f.fund_id,
        f.fund_name,
        f.category,
        f.amc,
        f.fund_manager,
        f.benchmark,
        f.expense_ratio,
        f.aum_cr,
        f.current_nav,
        f.nav_date,
        f.launch_date || null,
      ]
    );
  }
  console.log(`Inserted ${funds.length} funds`);

  await runQuery(`DELETE FROM holdings`);
  for (const h of holdings) {
    await runQuery(
      `INSERT INTO holdings (fund_id, fund_name, units, purchase_nav, purchase_date, folio_no)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [h.fund_id, h.fund_name, h.units, h.purchase_nav, h.purchase_date, h.folio_no || null]
    );
  }
  console.log(`Inserted ${holdings.length} holdings`);

  for (const t of txns) {
    await runQuery(
      `INSERT INTO transactions (txn_id, fund_id, folio_no, txn_type, units, nav, amount, txn_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (txn_id) DO NOTHING`,
      [t.txn_id, t.fund_id, t.folio_no || null, t.txn_type, t.units, t.nav, t.amount, t.txn_date]
    );
  }
  console.log(`Inserted ${txns.length} transactions`);
  console.log('Ingestion complete');
}
