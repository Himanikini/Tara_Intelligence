// src/scorers/scorers.ts
import { z } from 'zod';
import { createToolCallAccuracyScorerCode } from '@mastra/evals/scorers/prebuilt';
import { createCompletenessScorer } from '@mastra/evals/scorers/prebuilt';
import { getAssistantMessageFromRunOutput, getUserMessageFromRunInput } from '@mastra/evals/scorers/utils';
import { createScorer } from '@mastra/core/evals';

// ── Scorer 1: Tool Call Appropriateness ───────────────────────────────────────
// Checks that Tara calls the right tool for portfolio questions.
// FIX: was checking for 'weatherTool' — updated to portfolio tools.
// strictMode: false means partial credit if any valid tool is called.
export const toolCallAppropriatenessScorer = createToolCallAccuracyScorerCode({
  expectedTool: 'portfolio_analysis',
  strictMode: false,
});

// ── Scorer 2: Completeness ────────────────────────────────────────────────────
// Checks that the assistant's answer covers all parts of the user's question.
export const completenessScorer = createCompletenessScorer();

// ── Scorer 3: Financial Accuracy Scorer ──────────────────────────────────────
// FIX: replaced the translation scorer (irrelevant for a portfolio app) with
// a financial accuracy scorer that checks the answer contains real numbers,
// fund names, and does not make up data.
export const financialAccuracyScorer = createScorer({
  id: 'financial-accuracy-scorer',
  name: 'Financial Accuracy',
  description:
    'Checks that the assistant response contains specific financial data (numbers, fund names, percentages) and does not give vague or made-up answers',
  type: 'agent',
  judge: {
    // FIX: was 'openai/gpt-5-mini' which does not exist — use a valid model string
    model: 'google/gemini-2.5-flash',
    instructions:
      'You are an expert evaluator of AI financial assistant responses. ' +
      'Your job is to check whether the assistant gave a specific, data-backed answer ' +
      'or a vague, non-committal one. ' +
      'A good answer contains actual numbers, fund names, percentages, or rupee amounts pulled from data. ' +
      'A bad answer says things like "I cannot access your portfolio" or gives made-up placeholder values. ' +
      'Return only structured JSON matching the provided schema.',
  },
})
  .preprocess(({ run }) => {
    const userText      = getUserMessageFromRunInput(run.input)   || '';
    const assistantText = getAssistantMessageFromRunOutput(run.output) || '';
    return { userText, assistantText };
  })
  .analyze({
    description: 'Detect whether the response contains real financial data or is vague/hallucinated',
    outputSchema: z.object({
      hasNumbers:      z.boolean().describe('Response contains specific numbers or amounts'),
      hasFundNames:    z.boolean().describe('Response mentions specific fund names'),
      isVague:         z.boolean().describe('Response is vague or refuses to answer'),
      isHallucinated:  z.boolean().describe('Response appears to contain made-up data'),
      confidence:      z.number().min(0).max(1).default(1),
      explanation:     z.string().default(''),
    }),
    createPrompt: ({ results }) => `
      You are evaluating whether a portfolio AI assistant gave a specific, data-backed answer.

      User question:
      """
      ${results.preprocessStepResult.userText}
      """

      Assistant response:
      """
      ${results.preprocessStepResult.assistantText}
      """

      Tasks:
      1) Does the response contain specific numbers, rupee amounts, or percentages?
      2) Does the response mention specific fund names?
      3) Is the response vague (e.g. "I cannot access your data", "I don't know")?
      4) Does the response appear to contain made-up or placeholder values?

      Return JSON:
      {
        "hasNumbers":     boolean,
        "hasFundNames":   boolean,
        "isVague":        boolean,
        "isHallucinated": boolean,
        "confidence":     number,
        "explanation":    string
      }
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};

    // Vague or hallucinated responses score 0
    if (r.isVague)        return 0;
    if (r.isHallucinated) return 0;

    // Full score only if both numbers and fund names are present
    if (r.hasNumbers && r.hasFundNames) {
      return Math.max(0, Math.min(1, 0.8 + 0.2 * (r.confidence ?? 1)));
    }

    // Partial credit if only one of the two is present
    if (r.hasNumbers || r.hasFundNames) return 0.5;

    return 0.2;
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return (
      `Financial accuracy: hasNumbers=${r.hasNumbers ?? false}, ` +
      `hasFundNames=${r.hasFundNames ?? false}, ` +
      `isVague=${r.isVague ?? false}, ` +
      `isHallucinated=${r.isHallucinated ?? false}, ` +
      `confidence=${r.confidence ?? 0}. ` +
      `Score=${score}. ${r.explanation ?? ''}`
    );
  });

// ── Named exports for index.ts ────────────────────────────────────────────────
export const scorers = {
  toolCallAppropriatenessScorer,
  completenessScorer,
  financialAccuracyScorer,
};