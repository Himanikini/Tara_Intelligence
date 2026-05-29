import * as dotenv from 'dotenv';
import { queryTransactions, portfolioAnalysis, queryBankTransactions, queryHealthTransactions, TOOL_DEFINITIONS } from '../tools/tools.ts';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash';

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY not set — /ask endpoint will fail');
}

// ── Convert tool definitions → Gemini functionDeclarations format ─────────────
function toGeminiFunctions(toolDefs: any[]) {
  return toolDefs.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

// ── Execute whichever tool Gemini requests ─────────────────────────────────────
async function executeTool(name: string, args: any): Promise<any> {
  console.log(`[Tool] ${name}`, JSON.stringify(args));

  if (name === 'query_transactions')        return queryTransactions(args);
  if (name === 'portfolio_analysis')        return portfolioAnalysis(args);
  if (name === 'query_bank_transactions')   return queryBankTransactions(args);
  if (name === 'query_health_transactions') return queryHealthTransactions(args);
  if (name === 'query_funds')               return queryTransactions({ ...args, table: 'funds' });
  if (name === 'query_holdings')            return queryTransactions({ ...args, table: 'holdings' });

  return { success: false, error: `Unknown tool: ${name}` };
}

// ── Main exported function called by server.ts ─────────────────────────────────
export async function askTara(userQuestion: string): Promise<{
  answer: string;
  traces: any[];
  total_latency_ms: number;
}> {
  const start = Date.now();

  if (!GEMINI_API_KEY) {
    return {
      answer: 'GEMINI_API_KEY is not configured. Please add it to your .env file.',
      traces: [],
      total_latency_ms: Date.now() - start,
    };
  }

  const systemInstruction = `
You are Tara, an intelligent AI assistant for personal finance and mutual fund portfolio analysis.
You have access to 5 database tables:

1. bank_transactions   — daily expenses (groceries, food, utilities, shopping, fuel, health, entertainment)
2. health_transactions — medical expenses (pharmacy, consultation, diagnostics, fitness, optical)
3. funds               — mutual fund master data (NAV, expense ratio, AUM, fund manager)
4. holdings            — current mutual fund holdings (units, purchase NAV, purchase date)
5. fund_transactions   — mutual fund buy/sell/dividend history

STRICT RULES:
- ALWAYS call a tool first before answering — never guess or make up numbers.
- Pick the correct tool based on the question:
  * Bank spending / expenses             → query_bank_transactions
  * Health / medical expenses            → query_health_transactions
  * Fund details / NAV / expense ratio   → query_funds
  * Current holdings / portfolio value   → query_holdings
  * Fund buy/sell/dividend history       → query_transactions
  * Portfolio performance / analysis     → portfolio_analysis
- Format all amounts in Indian Rupees ₹ with commas (e.g. ₹1,23,456.78).
- Be concise, accurate and helpful.
- If a question spans multiple tables, call multiple tools.
`;

  // Gemini conversation history
  let contents: any[] = [
    { role: 'user', parts: [{ text: userQuestion }] },
  ];

  const traces: any[] = [];
  let finalAnswer = 'Sorry, I could not generate an answer. Please try again.';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // Agentic loop — Gemini may call multiple tools before final answer
  for (let i = 0; i < 10; i++) {
    const body = {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      tools: [{ functionDeclarations: toGeminiFunctions(TOOL_DEFINITIONS) }],
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini API error ${resp.status}: ${errText}`);
    }

    const json = await resp.json();
    const candidate = json?.candidates?.[0];
    const parts: any[] = candidate?.content?.parts || [];

    // Check if Gemini wants to call a function
    const functionCallPart = parts.find((p: any) => p.functionCall);

    if (functionCallPart) {
      const { name, args } = functionCallPart.functionCall;
      const toolStart = Date.now();
      const toolResult = await executeTool(name, args);
      const toolMs = Date.now() - toolStart;

      traces.push({
        type: 'tool_call',
        tool_name: name,
        content: JSON.stringify(args),
        latency_ms: toolMs,
      });
      traces.push({
        type: 'tool_result',
        tool_name: name,
        content: JSON.stringify(toolResult).slice(0, 500),
        latency_ms: null,
      });

      // Add model function call to history
      contents.push({ role: 'model', parts: [{ functionCall: { name, args } }] });

      // Add tool result as user turn
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: toolResult,
          },
        }],
      });

      continue;
    }

    // No function call → final text answer
    const textPart = parts.find((p: any) => p.text);
    if (textPart?.text) {
      finalAnswer = textPart.text;
    }
    break;
  }

  return {
    answer: finalAnswer,
    traces,
    total_latency_ms: Date.now() - start,
  };
}