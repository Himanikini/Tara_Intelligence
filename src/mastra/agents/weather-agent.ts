// src/tara.ts  (was agent.ts — server imports it as tara.js)
import * as dotenv from 'dotenv';
// FIX: import from tools.ts, not from misnamed weather-tool.js
import { queryTransactions, portfolioAnalysis, TOOL_DEFINITIONS } from '../tools/tools.ts';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// FIX: always use gemini-2.5-flash, not the old text-bison-001 PaLM model
const GEMINI_MODEL = 'gemini-2.5-flash';

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY not set — /ask endpoint will fail');
}

// ── Convert our tool definitions → Gemini functionDeclarations format ────────
function toGeminiFunctions(toolDefs: any[]) {
  return toolDefs.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

// ── Execute whichever tool Gemini requests ────────────────────────────────────
async function executeTool(name: string, args: any): Promise<any> {
  console.log(`[Tool] ${name}`, JSON.stringify(args));
  if (name === 'query_transactions') return queryTransactions(args);
  if (name === 'portfolio_analysis') return portfolioAnalysis(args);
  return { success: false, error: `Unknown tool: ${name}` };
}

// ── Main exported function called by server.ts ────────────────────────────────
export async function askTara(userQuestion: string): Promise<{
  answer: string;
  traces: any[];
  total_latency_ms: number;
}> {
  const start = Date.now();

  if (!GEMINI_API_KEY) {
    return {
      answer: ' GEMINI_API_KEY is not configured. Please add it to your .env file.',
      traces: [],
      total_latency_ms: Date.now() - start,
    };
  }

  const systemInstruction =
    'You are Tara, an intelligent AI assistant for mutual fund portfolio analysis. ' +
    'You MUST use the provided tools to fetch real data from the database — never guess numbers or make up values. ' +
    'Always call a tool first, then compose your answer from the actual tool result. ' +
    'Format numbers clearly (e.g. ₹1,23,456.78). Be concise and helpful.';

  // Gemini conversation history — starts with the user question
  let contents: any[] = [
    { role: 'user', parts: [{ text: userQuestion }] },
  ];

  const traces: any[] = [];
  let finalAnswer = 'Sorry, I could not generate an answer. Please try again.';

  // FIX: proper Gemini REST URL with ?key= query param (not Bearer header)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  // Agentic loop — Gemini may call tools before giving final text answer
  for (let i = 0; i < 6; i++) {
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
        content: JSON.stringify(toolResult).slice(0, 300),
        latency_ms: null,
      });

      // Add model's function call to history
      contents.push({ role: 'model', parts: [{ functionCall: { name, args } }] });
      // Add tool result — Gemini expects this as a "user" turn with functionResponse
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: toolResult,
          },
        }],
      });

      continue; // let Gemini see the result and respond
    }

    // No function call → Gemini gave us the final text answer
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