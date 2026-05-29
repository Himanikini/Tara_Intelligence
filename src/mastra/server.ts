// src/mastra/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { taraAgent } from './index.ts';
import { answerQuestionLocally } from './fallback.ts';
import { runIngestion } from './ingest.ts';
import { pool } from './db.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const publicDir  = path.resolve(__dirname, '..', '..', 'public');

const app  = express();
const PORT = Number(process.env.PORT || 3000);

//MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(publicDir));

// IN-MEMORY REQUEST LOG 
interface RequestLog {
  id:              string;
  timestamp:       string;
  question:        string;
  status:          'pending' | 'success' | 'error';
  latency_ms?:     number;
  trace_count?:    number;
  answer_preview?: string;
}

const requestLogs: RequestLog[] = [];

//ask
async function safeAnswerQuestionLocally(question: string) {
  try {
    return await answerQuestionLocally(question);
  } catch (err: any) {
    console.error('[fallback error]', err?.message || err);
    return null;
  }
}

app.post('/ask', async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required' });
  }

  const id    = uuidv4();
  const start = Date.now();
  const log: RequestLog = {
    id,
    timestamp: new Date().toISOString(),
    question,
    status: 'pending',
  };
  requestLogs.unshift(log);

  try {
    const localAnswer = await safeAnswerQuestionLocally(question);
    if (localAnswer) {
      const latency = Date.now() - start;
      log.status         = 'success';
      log.latency_ms     = latency;
      log.trace_count    = 0;
      log.answer_preview = localAnswer.slice(0, 120);
      return res.json({
        id,
        answer:           localAnswer,
        traces:           [],
        total_latency_ms: latency,
      });
    }

    const result = await taraAgent.generate(question);

    const traces = (result.steps ?? []).flatMap((step: any) => {
      const items: any[] = [];
      if (step.toolCalls?.length) {
        step.toolCalls.forEach((tc: any) => {
          items.push({
            type:       'tool_call',
            tool_name:  tc.toolName,
            content:    JSON.stringify(tc.args ?? {}),
            latency_ms: null,
          });
        });
      }
      if (step.toolResults?.length) {
        step.toolResults.forEach((tr: any) => {
          items.push({
            type:       'tool_result',
            tool_name:  tr.toolName,
            content:    JSON.stringify(tr.result ?? {}).slice(0, 300),
            latency_ms: null,
          });
        });
      }
      return items;
    });

    const latency = Date.now() - start;
    log.status         = 'success';
    log.latency_ms     = latency;
    log.trace_count    = traces.length;
    log.answer_preview = result.text?.slice(0, 120);

    return res.json({
      id,
      answer:           result.text ?? '',
      traces,
      total_latency_ms: latency,
    });

  } catch (err: any) {
    const fallbackAnswer = await safeAnswerQuestionLocally(question);
    if (fallbackAnswer) {
      const latency = Date.now() - start;
      log.status         = 'success';
      log.latency_ms     = latency;
      log.trace_count    = 0;
      log.answer_preview = fallbackAnswer.slice(0, 120);
      return res.json({
        id,
        answer:           fallbackAnswer,
        traces:           [],
        total_latency_ms: latency,
      });
    }
    log.status         = 'error';
    log.answer_preview = err.message;
    console.error('[/ask error]', err.message);
    return res.status(500).json({ id, error: err.message });
  }
});

//api/logs 
app.get('/api/logs', (_req, res) => {
  res.json(requestLogs.slice(0, 50));
});

//api/stats 
app.get('/api/stats', async (_req, res) => {
  try {
    const [fundsRes, holdingsRes, txnRes] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM funds'),
      pool.query('SELECT COUNT(*) FROM holdings'),
      pool.query('SELECT COUNT(*) FROM transactions'),
    ]);

    const total   = requestLogs.length;
    const success = requestLogs.filter((l) => l.status === 'success').length;
    const error   = requestLogs.filter((l) => l.status === 'error').length;
    const avgLatency =
      requestLogs
        .filter((l) => l.latency_ms)
        .reduce((sum, l) => sum + (l.latency_ms ?? 0), 0) /
      Math.max(success, 1);

    return res.json({
      db: {
        funds:        Number(fundsRes.rows[0].count),
        holdings:     Number(holdingsRes.rows[0].count),
        transactions: Number(txnRes.rows[0].count),
      },
      requests: {
        total,
        success,
        error,
        avg_latency_ms: Math.round(avgLatency),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

//api/ingest
app.post('/api/ingest', async (_req, res) => {
  try {
    await runIngestion();
    return res.json({ success: true, message: 'Ingestion complete' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// health 
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({
      status:    'ok',
      db:        'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({ status: 'degraded', db: 'disconnected' });
  }
});

// FALLBACK → serve index.html 
app.use((_req, res) => {
  res.sendFile(path.resolve(publicDir, 'index.html'));
});

// START 
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════╗
║   TARA INTELLIGENCE SERVER        ║
║   http://localhost:${PORT}            ║
║   DB → tara_intelligence          ║
╚════════════════════════════════════╝
  `);
});

export default app;