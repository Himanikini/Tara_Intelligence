import { pool } from './db.ts';

function formatCurrency(value: number) {
  return `Rs ${value.toFixed(2)}`;
}

function formatDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

async function findFundCandidates(question: string) {
  const q = question.toLowerCase();
  const result = await pool.query('SELECT fund_id, fund_name FROM funds');
  const rows = result.rows as Array<{ fund_id: string; fund_name: string }>;

  const exact = rows.find(
    (r) => q.includes(r.fund_id.toLowerCase()) || q.includes(r.fund_name.toLowerCase()),
  );
  if (exact) {
    return [exact];
  }

  const partial = rows.filter((r) => {
    const name = r.fund_name.toLowerCase();
    const id = r.fund_id.toLowerCase();
    return (
      name.split(/\s+/).some((word) => word && q.includes(word)) ||
      id.split(/[_\s]+/).some((word) => word && q.includes(word))
    );
  });

  return partial;
}

async function getPortfolioSummary() {
  const result = await pool.query(`
    SELECT
      h.fund_id,
      h.fund_name,
      f.category,
      h.units,
      h.purchase_nav,
      h.purchase_date,
      f.current_nav,
      f.nav_date,
      ROUND((h.units * h.purchase_nav)::numeric, 2) AS invested_amount,
      ROUND((h.units * f.current_nav)::numeric, 2) AS current_value,
      ROUND(((h.units * f.current_nav) - (h.units * h.purchase_nav))::numeric, 2) AS absolute_gain,
      ROUND((((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100)::numeric, 2) AS return_pct
    FROM holdings h
    LEFT JOIN funds f ON h.fund_id = f.fund_id
    ORDER BY current_value DESC
  `);

  const rows = result.rows as Array<any>;
  if (!rows.length) {
    return 'No portfolio holdings were found in the database.';
  }

  const totalInvested = rows.reduce((sum, row) => sum + Number(row.invested_amount), 0);
  const totalCurrent = rows.reduce((sum, row) => sum + Number(row.current_value), 0);
  const totalGain = totalCurrent - totalInvested;
  const totalReturnPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const topHoldings = rows.slice(0, 3).map((row) => {
    return `- ${row.fund_name} (${row.fund_id}): ${formatCurrency(Number(row.current_value))} current value as of ${formatDate(row.nav_date)}, invested ${formatCurrency(Number(row.invested_amount))}, gain ${formatCurrency(Number(row.absolute_gain))} (${Number(row.return_pct).toFixed(2)}%)`;
  });

  return [`Your portfolio summary:`,
    `Total invested: ${formatCurrency(totalInvested)}`,
    `Current value: ${formatCurrency(totalCurrent)}`,
    `Total gain: ${formatCurrency(totalGain)} (${totalReturnPct.toFixed(2)}%)`,
    `Holdings count: ${rows.length}`,
    `Top holdings:`,
    ...topHoldings,
  ].join('\n');
}

async function getAllocationSummary() {
  const result = await pool.query(`
    SELECT
      f.category,
      ROUND(SUM(h.units * f.current_nav)::numeric, 2) AS total_value
    FROM holdings h
    LEFT JOIN funds f ON h.fund_id = f.fund_id
    GROUP BY f.category
    ORDER BY total_value DESC
  `);

  const rows = result.rows as Array<any>;
  if (!rows.length) {
    return 'No allocation data is available.';
  }

  const total = rows.reduce((sum, row) => sum + Number(row.total_value), 0);
  const lines = rows.map((row) => {
    const pct = total > 0 ? ((Number(row.total_value) / total) * 100).toFixed(2) : '0.00';
    return `- ${row.category}: ${formatCurrency(Number(row.total_value))} (${pct}%)`;
  });

  return [`Portfolio allocation by category:`, ...lines].join('\n');
}

async function getRecentTransactions(limit = 10) {
  const result = await pool.query(`
    SELECT
      t.txn_date,
      t.fund_id,
      f.fund_name,
      t.txn_type,
      t.units,
      t.nav,
      t.amount
    FROM transactions t
    LEFT JOIN funds f ON t.fund_id = f.fund_id
    ORDER BY t.txn_date DESC, t.txn_id DESC
    LIMIT $1
  `, [limit]);

  const rows = result.rows as Array<any>;
  if (!rows.length) {
    return 'No transactions are available yet.';
  }

  const lines = rows.map((row) => {
    return `- ${formatDate(row.txn_date)} | ${row.txn_type} | ${row.fund_name} (${row.fund_id}) | ${row.units} units @ Rs ${Number(row.nav).toFixed(2)} | amount ${formatCurrency(Number(row.amount))}`;
  });

  return [`Recent transaction history:`, ...lines].join('\n');
}

async function getFundSummary(fund: { fund_id: string; fund_name: string }) {
  const result = await pool.query(`
    SELECT
      h.fund_id,
      h.fund_name,
      f.category,
      h.units,
      h.purchase_nav,
      h.purchase_date,
      f.current_nav,
      f.nav_date,
      ROUND((h.units * h.purchase_nav)::numeric, 2) AS invested_amount,
      ROUND((h.units * f.current_nav)::numeric, 2) AS current_value,
      ROUND(((h.units * f.current_nav) - (h.units * h.purchase_nav))::numeric, 2) AS absolute_gain,
      ROUND((((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100)::numeric, 2) AS return_pct
    FROM holdings h
    LEFT JOIN funds f ON h.fund_id = f.fund_id
    WHERE h.fund_id = $1
    LIMIT 1
  `, [fund.fund_id]);

  if (!result.rows.length) {
    return `I found the fund ${fund.fund_name} (${fund.fund_id}), but there is no holding or current data available.`;
  }

  const row = result.rows[0];
  const lines = [
    `Fund summary for ${row.fund_name} (${row.fund_id}):`,
    `- Category: ${row.category}`,
    `- Current NAV: Rs ${Number(row.current_nav).toFixed(2)} as of ${formatDate(row.nav_date)}`,
    `- Units held: ${Number(row.units).toFixed(2)}`,
    `- Invested amount: ${formatCurrency(Number(row.invested_amount))}`,
    `- Current value: ${formatCurrency(Number(row.current_value))}`,
    `- Gain: ${formatCurrency(Number(row.absolute_gain))} (${Number(row.return_pct).toFixed(2)}%)`,
    `- Purchase date: ${formatDate(row.purchase_date)}`,
  ];

  return lines.join('\n');
}

async function getTopPerformingFunds(limit = 3) {
  const result = await pool.query(`
    SELECT
      h.fund_id,
      h.fund_name,
      f.category,
      h.units,
      h.purchase_nav,
      f.current_nav,
      f.nav_date,
      ROUND(((h.units * f.current_nav) - (h.units * h.purchase_nav))::numeric, 2) AS absolute_gain,
      ROUND((((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100)::numeric, 2) AS return_pct
    FROM holdings h
    LEFT JOIN funds f ON h.fund_id = f.fund_id
    ORDER BY return_pct DESC
    LIMIT $1
  `, [limit]);

  const rows = result.rows as Array<any>;
  if (!rows.length) {
    return 'No holdings are available to determine best performing funds.';
  }

  const lines = rows.map((row) => {
    return `- ${row.fund_name} (${row.fund_id}): ${Number(row.return_pct).toFixed(2)}% return, gain ${formatCurrency(Number(row.absolute_gain))}`;
  });

  return [`Top ${limit} performing funds:`, ...lines].join('\n');
}

export async function answerQuestionLocally(question: string) {
  const q = question.toLowerCase();

  if (/(portfolio summary|total portfolio value|current portfolio value|portfolio performance|show my .*portfolio|my portfolio summary|portfolio value)/.test(q)) {
    return getPortfolioSummary();
  }

  if (/(transaction history|transactions history|recent transactions|show.*transactions|txn history|show.*txn|transaction list)/.test(q)) {
    return getRecentTransactions(10);
  }

  if (/(allocation|asset allocation|category breakdown|allocation by category)/.test(q)) {
    return getAllocationSummary();
  }

  if (/(best performing|top performing|highest return|highest gain|best fund)/.test(q)) {
    return getTopPerformingFunds(3);
  }

  const fundCandidates = await findFundCandidates(question);
  if (fundCandidates.length) {
    const fund = fundCandidates[0];
    if (/(current value|value of|holding value|invested in|investment in|what is .* value|show.*fund|fund summary)/.test(q)) {
      return getFundSummary(fund);
    }
  }

  return null;
}
