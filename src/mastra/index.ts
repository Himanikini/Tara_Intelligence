// src/index.ts
import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  queryTransactions,
  portfolioAnalysis,
} from './tools/tools.ts';

import {
  toolCallAppropriatenessScorer,
  completenessScorer,
  financialAccuracyScorer,
} from './scorers/weather-scorer.ts';

// ── Tools ─────────────────────────────────────────────────────────────────────

const queryTransactionsTool = createTool({
  id: 'query_transactions',
  description:
    'Query and aggregate mutual fund transactions. Handles BUY, SELL, DIVIDEND. ' +
    'Supports net calculations, date ranges, and fund filtering.',
  inputSchema: z.object({
    fund_id:   z.string().optional().describe('Exact fund ID e.g. fund_bluechip'),
    fund_name: z.string().optional().describe('Partial fund name for fuzzy matching'),
    txn_type:  z.union([z.string(), z.array(z.string())]).optional()
                .describe('BUY, SELL, DIVIDEND or array of types'),
    from_date: z.string().optional().describe('Start date YYYY-MM-DD'),
    to_date:   z.string().optional().describe('End date YYYY-MM-DD'),
    folio_no:  z.string().optional().describe('Filter by folio number'),
    aggregate: z.enum(['sum_amount', 'sum_units', 'count', 'net_amount']).optional()
                .describe('net_amount = BUY minus SELL for true invested figure'),
  }),
  execute: async ({ context }) => {
    return queryTransactions(context);
  },
});

const portfolioAnalysisTool = createTool({
  id: 'portfolio_analysis',
  description:
    'Analyze mutual fund portfolio holdings. Computes current values, gains, ' +
    'returns, and allocations using SQL.',
  inputSchema: z.object({
    mode: z
      .enum(['summary', 'holding_return', 'fund_period_return', 'allocation', 'fund_detail'])
      .describe(
        'summary=full portfolio, holding_return=user gains, ' +
        'fund_period_return=NAV performance, allocation=category breakdown, ' +
        'fund_detail=single fund',
      ),
    fund_id:   z.string().optional().describe('Exact fund ID'),
    fund_name: z.string().optional().describe('Partial fund name'),
    from_date: z.string().optional().describe('Period start YYYY-MM-DD'),
    to_date:   z.string().optional().describe('Period end YYYY-MM-DD'),
  }),
  execute: async ({ context }) => {
    return portfolioAnalysis(context);
  },
});

// ── Agent ─────────────────────────────────────────────────────────────────────

export const taraAgent = new Agent({
  id: 'tara',
  name: 'Tara',
  instructions:
    'You are Tara, an intelligent AI assistant for mutual fund portfolio analysis. ' +
    'You MUST use the provided tools to fetch real data from the database — never guess numbers. ' +
    'Always call a tool first, then answer based on the actual result. ' +
    'Format currency in Indian Rupees (Rs). Be concise and clear.',
  model: {
    id: 'google/gemini-2.5-flash',
    apiKey: process.env.GEMINI_API_KEY,
  },
  tools: {
    query_transactions: queryTransactionsTool,
    portfolio_analysis: portfolioAnalysisTool,
  },
});

// ── Mastra instance ───────────────────────────────────────────────────────────

export const mastra = new Mastra({
  agents: {
    tara: taraAgent,
  },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    financialAccuracyScorer,
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./mastra.db',
  }),
  logger: new PinoLogger({
    name: 'Tara',
    level: 'info',
  }),
});