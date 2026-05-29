import { pool } from './db.ts';

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ─── Tool: query_bank_transactions ────────────────────────────────────────────
export async function queryBankTransactions(params: {
  category?: string;
  merchant?: string;
  from_date?: string;
  to_date?: string;
  aggregate?: 'sum_amount' | 'count' | 'by_category' | 'by_merchant';
}): Promise<ToolResult> {
  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.category) {
      conditions.push(`category ILIKE $${idx++}`);
      values.push(`%${params.category}%`);
    }
    if (params.merchant) {
      conditions.push(`merchant ILIKE $${idx++}`);
      values.push(`%${params.merchant}%`);
    }
    if (params.from_date) {
      conditions.push(`txn_date >= $${idx++}`);
      values.push(params.from_date);
    }
    if (params.to_date) {
      conditions.push(`txn_date <= $${idx++}`);
      values.push(params.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query: string;

    if (params.aggregate === 'by_category') {
      query = `
        SELECT
          category,
          COUNT(*) AS txn_count,
          ROUND(SUM(amount)::numeric, 2) AS total_amount
        FROM tara_intelligent.bank_transactions
        ${whereClause}
        GROUP BY category
        ORDER BY total_amount DESC
      `;
    } else if (params.aggregate === 'by_merchant') {
      query = `
        SELECT
          merchant,
          category,
          COUNT(*) AS txn_count,
          ROUND(SUM(amount)::numeric, 2) AS total_amount
        FROM tara_intelligent.bank_transactions
        ${whereClause}
        GROUP BY merchant, category
        ORDER BY total_amount DESC
      `;
    } else if (params.aggregate === 'sum_amount') {
      query = `
        SELECT
          ROUND(SUM(amount)::numeric, 2) AS total_amount,
          COUNT(*) AS txn_count
        FROM tara_intelligent.bank_transactions
        ${whereClause}
      `;
    } else if (params.aggregate === 'count') {
      query = `
        SELECT COUNT(*) AS txn_count
        FROM tara_intelligent.bank_transactions
        ${whereClause}
      `;
    } else {
      query = `
        SELECT
          txn_id, txn_date, merchant, category,
          amount, currency, memo
        FROM tara_intelligent.bank_transactions
        ${whereClause}
        ORDER BY txn_date DESC
        LIMIT 100
      `;
    }

    const result = await pool.query(query, values);
    return { success: true, data: { rows: result.rows, row_count: result.rowCount } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Tool: query_health_transactions ─────────────────────────────────────────
export async function queryHealthTransactions(params: {
  sub_category?: string;
  merchant?: string;
  from_date?: string;
  to_date?: string;
  aggregate?: 'sum_amount' | 'count' | 'by_subcategory' | 'by_merchant';
}): Promise<ToolResult> {
  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.sub_category) {
      conditions.push(`sub_category ILIKE $${idx++}`);
      values.push(`%${params.sub_category}%`);
    }
    if (params.merchant) {
      conditions.push(`merchant ILIKE $${idx++}`);
      values.push(`%${params.merchant}%`);
    }
    if (params.from_date) {
      conditions.push(`txn_date >= $${idx++}`);
      values.push(params.from_date);
    }
    if (params.to_date) {
      conditions.push(`txn_date <= $${idx++}`);
      values.push(params.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query: string;

    if (params.aggregate === 'by_subcategory') {
      query = `
        SELECT
          sub_category,
          COUNT(*) AS txn_count,
          ROUND(SUM(amount)::numeric, 2) AS total_amount
        FROM tara_intelligent.health_transactions
        ${whereClause}
        GROUP BY sub_category
        ORDER BY total_amount DESC
      `;
    } else if (params.aggregate === 'by_merchant') {
      query = `
        SELECT
          merchant,
          sub_category,
          COUNT(*) AS txn_count,
          ROUND(SUM(amount)::numeric, 2) AS total_amount
        FROM tara_intelligent.health_transactions
        ${whereClause}
        GROUP BY merchant, sub_category
        ORDER BY total_amount DESC
      `;
    } else if (params.aggregate === 'sum_amount') {
      query = `
        SELECT
          ROUND(SUM(amount)::numeric, 2) AS total_amount,
          COUNT(*) AS txn_count
        FROM tara_intelligent.health_transactions
        ${whereClause}
      `;
    } else if (params.aggregate === 'count') {
      query = `
        SELECT COUNT(*) AS txn_count
        FROM tara_intelligent.health_transactions
        ${whereClause}
      `;
    } else {
      query = `
        SELECT
          h.txn_id, h.txn_date, h.merchant, h.sub_category,
          h.amount, h.currency, h.memo, h.bank_txn_id
        FROM tara_intelligent.health_transactions h
        ${whereClause}
        ORDER BY h.txn_date DESC
        LIMIT 100
      `;
    }

    const result = await pool.query(query, values);
    return { success: true, data: { rows: result.rows, row_count: result.rowCount } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Tool: query_transactions ─────────────────────────────────────────────────
export async function queryTransactions(params: {
  fund_id?: string;
  fund_name?: string;
  txn_type?: string | string[];
  from_date?: string;
  to_date?: string;
  folio_no?: string;
  table?: string;
  aggregate?: 'sum_amount' | 'sum_units' | 'count' | 'net_amount';
}): Promise<ToolResult> {
  try {
    // Handle funds and holdings table queries
    if (params.table === 'funds') {
      const result = await pool.query(`SELECT * FROM tara_intelligent.funds ORDER BY fund_name`);
      return { success: true, data: { rows: result.rows, row_count: result.rowCount } };
    }

    if (params.table === 'holdings') {
      const result = await pool.query(`
        SELECT
          h.fund_id, h.fund_name, h.units,
          h.purchase_date, h.purchase_nav,
          f.current_nav, f.category,
          ROUND((h.units * h.purchase_nav)::numeric, 2) AS invested_amount,
          ROUND((h.units * f.current_nav)::numeric, 2)  AS current_value,
          ROUND(((h.units * f.current_nav) - (h.units * h.purchase_nav))::numeric, 2) AS absolute_gain,
          ROUND((((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100)::numeric, 2) AS return_pct
        FROM tara_intelligent.holdings h
        LEFT JOIN tara_intelligent.funds f ON h.fund_id = f.fund_id
        ORDER BY current_value DESC
      `);
      return { success: true, data: { rows: result.rows, row_count: result.rowCount } };
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (params.fund_id) {
      conditions.push(`t.fund_id = $${idx++}`);
      values.push(params.fund_id);
    } else if (params.fund_name) {
      conditions.push(`(f.fund_name ILIKE $${idx} OR t.fund_id ILIKE $${idx})`);
      values.push(`%${params.fund_name}%`);
      idx++;
    }

    if (params.txn_type) {
      const types = Array.isArray(params.txn_type) ? params.txn_type : [params.txn_type];
      conditions.push(`t.txn_type = ANY($${idx++})`);
      values.push(types);
    }

    if (params.from_date) {
      conditions.push(`t.txn_date >= $${idx++}`);
      values.push(params.from_date);
    }
    if (params.to_date) {
      conditions.push(`t.txn_date <= $${idx++}`);
      values.push(params.to_date);
    }
    if (params.folio_no) {
      conditions.push(`t.folio_no = $${idx++}`);
      values.push(params.folio_no);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query: string;

    if (params.aggregate === 'net_amount') {
      query = `
        SELECT
          t.fund_id,
          f.fund_name,
          SUM(CASE WHEN t.txn_type IN ('BUY','DIVIDEND') THEN t.amount
                   WHEN t.txn_type = 'SELL' THEN -t.amount
                   ELSE 0 END) AS net_amount,
          SUM(CASE WHEN t.txn_type = 'BUY' THEN t.units
                   WHEN t.txn_type = 'SELL' THEN -t.units
                   ELSE 0 END) AS net_units,
          COUNT(*) AS txn_count
        FROM tara_intelligent.fund_transactions t
        LEFT JOIN tara_intelligent.funds f ON t.fund_id = f.fund_id
        ${whereClause}
        GROUP BY t.fund_id, f.fund_name
        ORDER BY net_amount DESC
      `;
    } else if (params.aggregate === 'sum_amount') {
      query = `
        SELECT
          t.fund_id, f.fund_name,
          ROUND(SUM(t.amount)::numeric, 2) AS total_amount,
          COUNT(*) AS txn_count
        FROM tara_intelligent.fund_transactions t
        LEFT JOIN tara_intelligent.funds f ON t.fund_id = f.fund_id
        ${whereClause}
        GROUP BY t.fund_id, f.fund_name
        ORDER BY total_amount DESC
      `;
    } else if (params.aggregate === 'sum_units') {
      query = `
        SELECT
          t.fund_id, f.fund_name,
          SUM(t.units) AS total_units
        FROM tara_intelligent.fund_transactions t
        LEFT JOIN tara_intelligent.funds f ON t.fund_id = f.fund_id
        ${whereClause}
        GROUP BY t.fund_id, f.fund_name
      `;
    } else if (params.aggregate === 'count') {
      query = `
        SELECT COUNT(*) AS txn_count
        FROM tara_intelligent.fund_transactions t
        LEFT JOIN tara_intelligent.funds f ON t.fund_id = f.fund_id
        ${whereClause}
      `;
    } else {
      query = `
        SELECT
          t.txn_id, t.fund_id, f.fund_name, t.txn_type,
          t.units, t.nav, t.amount, t.txn_date, t.folio_no
        FROM tara_intelligent.fund_transactions t
        LEFT JOIN tara_intelligent.funds f ON t.fund_id = f.fund_id
        ${whereClause}
        ORDER BY t.txn_date DESC
        LIMIT 100
      `;
    }

    const result = await pool.query(query, values);
    return { success: true, data: { rows: result.rows, row_count: result.rowCount } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Tool: portfolio_analysis ─────────────────────────────────────────────────
export async function portfolioAnalysis(params: {
  mode: 'summary' | 'holding_return' | 'fund_period_return' | 'allocation' | 'fund_detail';
  fund_id?: string;
  fund_name?: string;
  from_date?: string;
  to_date?: string;
}): Promise<ToolResult> {
  try {
    let query: string;
    const values: any[] = [];

    if (params.mode === 'summary') {
      query = `
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
          ROUND((h.units * f.current_nav)::numeric, 2)  AS current_value,
          ROUND(((h.units * f.current_nav) - (h.units * h.purchase_nav))::numeric, 2) AS absolute_gain,
          ROUND((((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100)::numeric, 2) AS return_pct,
          f.expense_ratio,
          f.aum_cr,
          f.benchmark
        FROM tara_intelligent.holdings h
        LEFT JOIN tara_intelligent.funds f ON h.fund_id = f.fund_id
        ORDER BY current_value DESC
      `;

    } else if (params.mode === 'holding_return') {
      const fundCondition = params.fund_id
        ? `AND h.fund_id = $1`
        : params.fund_name
        ? `AND f.fund_name ILIKE $1`
        : '';
      if (params.fund_id) {
        values.push(params.fund_id);
      } else if (params.fund_name) {
        values.push(`%${params.fund_name}%`);
      }

      query = `
        SELECT
          h.fund_id, h.fund_name, h.units,
          h.purchase_nav, h.purchase_date,
          f.current_nav, f.nav_date,
          ROUND((h.units * h.purchase_nav)::numeric, 2) AS invested_amount,
          ROUND((h.units * f.current_nav)::numeric, 2)  AS current_value,
          ROUND(((h.units * f.current_nav) - (h.units * h.purchase_nav))::numeric, 2) AS absolute_gain,
          ROUND((((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100)::numeric, 2) AS return_pct,
          ROUND(
            (((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100 /
             NULLIF(EXTRACT(EPOCH FROM (f.nav_date - h.purchase_date)) / (365.25 * 86400), 0))::numeric,
          2) AS annualized_return_pct
        FROM tara_intelligent.holdings h
        LEFT JOIN tara_intelligent.funds f ON h.fund_id = f.fund_id
        WHERE 1=1 ${fundCondition}
      `;

    } else if (params.mode === 'fund_period_return') {
      const fromDate = params.from_date || '2023-01-01';
      const toDate   = params.to_date   || new Date().toISOString().split('T')[0];
      values.push(fromDate, toDate);

      query = `
        WITH nav_start AS (
          SELECT DISTINCT ON (fund_id) fund_id, nav AS start_nav, txn_date AS start_date
          FROM tara_intelligent.fund_transactions
          WHERE txn_date >= $1
          ORDER BY fund_id, txn_date ASC
        ),
        nav_end AS (
          SELECT DISTINCT ON (fund_id) fund_id, nav AS end_nav, txn_date AS end_date
          FROM tara_intelligent.fund_transactions
          WHERE txn_date <= $2
          ORDER BY fund_id, txn_date DESC
        )
        SELECT
          f.fund_id, f.fund_name, f.category,
          ns.start_nav, ns.start_date,
          ne.end_nav,   ne.end_date,
          ROUND(((ne.end_nav - ns.start_nav) / ns.start_nav * 100)::numeric, 2) AS period_return_pct
        FROM tara_intelligent.funds f
        JOIN nav_start ns ON f.fund_id = ns.fund_id
        JOIN nav_end   ne ON f.fund_id = ne.fund_id
        WHERE ns.start_nav IS NOT NULL AND ne.end_nav IS NOT NULL
        ORDER BY period_return_pct DESC
      `;

    } else if (params.mode === 'allocation') {
      query = `
        SELECT
          f.category,
          COUNT(h.fund_id) AS fund_count,
          ROUND(SUM(h.units * f.current_nav)::numeric, 2) AS total_value,
          ROUND(
            (SUM(h.units * f.current_nav) /
             SUM(SUM(h.units * f.current_nav)) OVER () * 100)::numeric,
          2) AS allocation_pct
        FROM tara_intelligent.holdings h
        LEFT JOIN tara_intelligent.funds f ON h.fund_id = f.fund_id
        GROUP BY f.category
        ORDER BY total_value DESC
      `;

    } else if (params.mode === 'fund_detail') {
      const fundCondition = params.fund_id ? `h.fund_id = $1` : `f.fund_name ILIKE $1`;
      values.push(params.fund_id || `%${params.fund_name}%`);

      query = `
        SELECT
          h.fund_id, h.fund_name, f.category, f.amc,
          f.fund_manager, f.benchmark, f.expense_ratio, f.aum_cr,
          h.units, h.purchase_nav, h.purchase_date,
          f.current_nav, f.nav_date,
          ROUND((h.units * h.purchase_nav)::numeric, 2) AS invested_amount,
          ROUND((h.units * f.current_nav)::numeric, 2)  AS current_value,
          ROUND(((h.units * f.current_nav) - (h.units * h.purchase_nav))::numeric, 2) AS absolute_gain,
          ROUND((((f.current_nav - h.purchase_nav) / h.purchase_nav) * 100)::numeric, 2) AS return_pct
        FROM tara_intelligent.holdings h
        LEFT JOIN tara_intelligent.funds f ON h.fund_id = f.fund_id
        WHERE ${fundCondition}
      `;

    } else {
      return { success: false, error: `Unknown mode: ${(params as any).mode}` };
    }

    const result = await pool.query(query, values);
    return { success: true, data: { rows: result.rows, row_count: result.rowCount } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Tool Definitions (Gemini function declarations) ──────────────────────────
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'query_bank_transactions',
      description:
        'Query bank transactions — daily expenses like groceries, food, utilities, shopping, fuel, health, entertainment. Use for spending questions.',
      parameters: {
        type: 'object',
        properties: {
          category:   { type: 'string', description: 'Category e.g. Groceries, Health, Fuel' },
          merchant:   { type: 'string', description: 'Merchant name e.g. Zomato, Amazon' },
          from_date:  { type: 'string', description: 'Start date YYYY-MM-DD' },
          to_date:    { type: 'string', description: 'End date YYYY-MM-DD' },
          aggregate: {
            type: 'string',
            enum: ['sum_amount', 'count', 'by_category', 'by_merchant'],
            description: 'by_category = spend per category, by_merchant = spend per merchant',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_health_transactions',
      description:
        'Query health and medical transactions — pharmacy, consultation, diagnostics, fitness, optical. Use for health expense questions.',
      parameters: {
        type: 'object',
        properties: {
          sub_category: { type: 'string', description: 'Sub-category e.g. pharmacy, fitness, consultation' },
          merchant:     { type: 'string', description: 'Merchant name e.g. Apollo, Fortis' },
          from_date:    { type: 'string', description: 'Start date YYYY-MM-DD' },
          to_date:      { type: 'string', description: 'End date YYYY-MM-DD' },
          aggregate: {
            type: 'string',
            enum: ['sum_amount', 'count', 'by_subcategory', 'by_merchant'],
            description: 'by_subcategory = spend per health category',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_transactions',
      description:
        'Query mutual fund transactions — BUY, SELL, DIVIDEND. Also handles funds master and holdings table queries.',
      parameters: {
        type: 'object',
        properties: {
          fund_id:   { type: 'string', description: 'Exact fund ID e.g. fund_bluechip' },
          fund_name: { type: 'string', description: 'Partial fund name for fuzzy match' },
          txn_type: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
            description: 'BUY, SELL, DIVIDEND or array',
          },
          from_date:  { type: 'string', description: 'Start date YYYY-MM-DD' },
          to_date:    { type: 'string', description: 'End date YYYY-MM-DD' },
          folio_no:   { type: 'string', description: 'Filter by folio number' },
          table: {
            type: 'string',
            enum: ['funds', 'holdings'],
            description: 'Pass funds to get fund master data, holdings to get current portfolio',
          },
          aggregate: {
            type: 'string',
            enum: ['sum_amount', 'sum_units', 'count', 'net_amount'],
            description: 'net_amount = BUY minus SELL',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'portfolio_analysis',
      description:
        'Analyze mutual fund portfolio — returns, gains, allocation breakdown, fund details.',
      parameters: {
        type: 'object',
        required: ['mode'],
        properties: {
          mode: {
            type: 'string',
            enum: ['summary', 'holding_return', 'fund_period_return', 'allocation', 'fund_detail'],
            description:
              'summary=full portfolio, holding_return=gains per fund, fund_period_return=NAV performance, allocation=category %, fund_detail=single fund deep dive',
          },
          fund_id:   { type: 'string', description: 'Exact fund ID' },
          fund_name: { type: 'string', description: 'Partial fund name' },
          from_date: { type: 'string', description: 'Period start YYYY-MM-DD' },
          to_date:   { type: 'string', description: 'Period end YYYY-MM-DD' },
        },
      },
    },
  },
];

// ─── Aliases ──────────────────────────────────────────────────────────────────
export { queryTransactions      as query_transactions };
export { portfolioAnalysis      as portfolio_analysis };
export { queryBankTransactions  as query_bank_transactions };
export { queryHealthTransactions as query_health_transactions };