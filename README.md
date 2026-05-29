# Tara Intelligence UI 
![Tara UI] (Tara_UI.png)

# Tara Intelligence

An AI-powered mutual fund portfolio assistant built with TypeScript, Express, Gemini 2.5 Flash, and Neon PostgreSQL.

Made by **Himani Kini**

---

## What it does

Tara lets you ask natural language questions about your mutual fund portfolio. It uses Google Gemini to understand the question, calls real SQL tools against your database, and returns an answer based on actual data — never guesses.
Features

Tara Intelligence allows users to ask natural language questions about:

Mutual fund portfolio
Fund transactions
Bank expenses
Health expenses
Food spending
Investment summaries
Monthly spending analysis

Example questions:

What is my total portfolio value?
Show my mutual fund transaction history.
How much did I spend on food last month?
What are my top expense categories?
Show health expenses in the last 30 days.
Compare investments versus spending.
---

## Project Structure

```
tara-project/
|__my-mastra-app
   |__node_module
   |__data
   |  |__fund.json
   |  |__transcation.json
   |  |__bank.json
   |  |__holding.json
   |  |__health.json
   |__ scripts/
   |   |__db.ts
   |   |__ingest.ts
   |   |__schema.ts
   └── src/
     ├── index.ts
     ├── server.ts
     ├── tools/
     │   └── tools.ts
     |__ agents
     |   |__ weather-agents.ts
     └── data/
     |    ├── funds.json
     |    ├── holdings.json
     |    └── transactions.json
     ├── .env
     ├── package.json
     ├── tsconfig.json
     ├── index.html 
    
```

### File Overview

`src/index.ts`
Mastra instance. Registers the Tara agent, tools, and LibSQL storage. This is the main entry point for the AI layer.

`src/server.ts`
Express server. Handles all HTTP routes — `/ask`, `/health`, `/api/stats`, `/api/logs`, `/api/ingest`. Calls `taraAgent.generate()` from Mastra.

`src/agents/weather-agent.ts`
Standalone Gemini agentic loop (used if running without Mastra). Handles the tool-calling cycle manually using the Gemini REST API.

`src/db.ts`
PostgreSQL connection pool using `pg`. Connects to Neon via `DATABASE_URL` with SSL.

`src/ingest.ts`
Creates database tables and loads data from the JSON files in `src/data/`. Run this once on first setup.

`src/tools/tools.ts`
Two tools: `queryTransactions` and `portfolioAnalysis`. These run parameterized SQL queries against the database and return results to the AI.

`src/data/`
Three JSON files that seed the database: `funds.json`, `holdings.json`, and `transactions.json`. Edit these with your own portfolio data and re-ingest.

`public/index.html`
The frontend. Single-page chat UI with a context panel, quick action buttons, and a request monitor that shows tool traces and latency.

---

## Tech Stack

- TypeScript (ESM)
- Node.js + Express
- Google Gemini 2.5 Flash
- Mastra AI framework
- PostgreSQL on Neon (cloud)
- node-postgres (`pg`)
- Vanilla HTML / CSS / JS frontend

---

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 14+
- A [Google AI Studio](https://aistudio.google.com) API key for Gemini

---

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Create your `.env` file**

DATABASE_URL=postgresql://postgres:himani18@localhost:5432/tara_intelligence

# ── DB Credentials (individual) ──
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tara_intelligence
DB_USER=postgres
DB_PASSWORD=himani18

PORT = 3000

**3. Start the development server**

```bash
npm run dev
```

**4. Open in browser**

```
http://localhost:3000
```

**. Load data into the database**

Click the "Re-ingest Data" button in the sidebar, or run:

```bash
curl -X POST http://localhost:3000/api/ingest
```

---

## Commands

```bash
npm run dev       # Start server with hot reload (tsx watch)
npm run build     # Compile TypeScript to dist/
npm start         # Run compiled production build
npm run ingest    # Run data ingestion from terminal
```

---


## Gemini API Key

1. Open Google AI Studio.
2. Sign in with your Google account.
3. Create a new API key.
4. Copy the generated key.
5. Paste it into the `.env` file:

```env
GEMINI_API_KEY=AQAb8RN6JNFsCwmjXQY9t8xaMPpuiUja2z2dagXyeo7W_pPvv-fQ

```

## API Routes

```
POST /ask              Send a question, receive AI answer and tool traces
GET  /health           Check server and database connection status
GET  /api/stats        DB record counts and request statistics
GET  /api/logs         Last 50 request logs
POST /api/ingest       Reload data from JSON files into the database
```

Example request:

```bash
curl -X POST http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is my total portfolio value?"}'
```

Example response:

```json
{
  "id": "abc-123",
  "answer": "Your total portfolio value is Rs 2,45,312.50 across 3 funds.",
  "traces": [
    { "type": "tool_call", "tool_name": "portfolio_analysis", "content": "{\"mode\":\"summary\"}" },
    { "type": "tool_result", "tool_name": "portfolio_analysis", "content": "{\"rows\":[...]}" }
  ],
  "total_latency_ms": 1243
}
```

---

## Database Schema

**funds**
```
fund_id        TEXT  PRIMARY KEY
fund_name      TEXT
category       TEXT
amc            TEXT
fund_manager   TEXT
benchmark      TEXT
expense_ratio  NUMERIC
aum_cr         NUMERIC
current_nav    NUMERIC
nav_date       DATE
```

**holdings**
```
id             SERIAL  PRIMARY KEY
fund_id        TEXT
fund_name      TEXT
units          NUMERIC
purchase_nav   NUMERIC
purchase_date  DATE
folio_no       TEXT
```

**transactions**
```
txn_id    TEXT  PRIMARY KEY
fund_id   TEXT
folio_no  TEXT
txn_type  TEXT   -- BUY / SELL / DIVIDEND
units     NUMERIC
nav       NUMERIC
amount    NUMERIC
txn_date  DATE
```

---

## Adding Your Own Data

Edit the files in `src/data/` and click Re-ingest.

`funds.json`

```json
[
  {
    "fund_id": "fund_bluechip",
    "fund_name": "HDFC Bluechip Fund",
    "category": "Large Cap",
    "amc": "HDFC AMC",
    "fund_manager": "Prashant Jain",
    "benchmark": "BSE 100",
    "expense_ratio": 1.05,
    "aum_cr": 34500,
    "current_nav": 98.45,
    "nav_date": "2024-12-01"
  }
]
```

`holdings.json`

```json
[
  {
    "fund_id": "fund_bluechip",
    "fund_name": "HDFC Bluechip Fund",
    "units": 250.50,
    "purchase_nav": 75.30,
    "purchase_date": "2022-03-15",
    "folio_no": "FOLIO001"
  }
]
```

`transactions.json`

```json
[
  {
    "txn_id": "TXN001",
    "fund_id": "fund_bluechip",
    "folio_no": "FOLIO001",
    "txn_type": "BUY",
    "units": 250.50,
    "nav": 75.30,
    "amount": 18862.65,
    "txn_date": "2022-03-15"
  }
]
```

---

## How the AI Works

1. User sends a question to `POST /ask`
2. Mastra passes it to the Tara agent (Gemini 2.5 Flash)
3. Gemini decides which tool to call — `query_transactions` or `portfolio_analysis`
4. The tool runs a parameterized SQL query on Neon PostgreSQL
5. The result is returned to Gemini
6. Gemini writes a natural language answer from the real data
7. The answer and tool traces are sent back to the frontend

All numbers in Tara's answers come from actual database queries.

---

## Troubleshooting

**DB offline in the UI**
Check that `DATABASE_URL` in your `.env` is correct and includes `?sslmode=require` at the end.

**Gemini API error**
Make sure `GEMINI_API_KEY` is set in `.env`. Get a free key at https://aistudio.google.com.

**"column does not exist" SQL error**
Your database tables are outdated. Click Re-ingest Data to drop and recreate them with the correct schema.

**Cannot find module error**
Run `npm run dev`, not `node src/server.ts` directly. The `tsx` runner handles TypeScript and path resolution.

**Port already in use**
Change `PORT=3001` in your `.env` file.

---

## Author

Himani Kini

---

## License

MIT