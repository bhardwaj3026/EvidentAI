import { generateAnswer } from './llm/provider.js';
import { detectHallucinations } from './detection.js';

/**
 * Runs Stage 7: Mitigation (Stricter Evidence-Constrained Re-generation & Re-evaluation)
 * Compares Original Pipeline Result vs Mitigated Pipeline Result.
 */
export async function runMitigationPass(originalPipelineResult) {
  const { provider, evidence, question, generation: origGeneration, detection: origDetection } = originalPipelineResult;

  const pLower = (provider || '').toLowerCase();
  const activeProvider = pLower.includes('gemini')
    ? 'gemini'
    : (pLower.includes('openai') || pLower.includes('gpt') ? 'openai' : 'claude');

  // 1. Re-generate answer with strict evidence-constrained prompt mode
  const mitigatedGen = await generateAnswer(
    activeProvider,
    evidence,
    question,
    { isMitigationMode: true }
  );

  // 2. Re-run hallucination detection on mitigated answer
  const mitigatedDetection = await detectHallucinations(
    mitigatedGen.answer,
    evidence,
    activeProvider
  );

  // 3. Compute Delta & Reduction Metrics
  const origRate = origDetection.summary.hallucinationRate;
  const mitigatedRate = mitigatedDetection.summary.hallucinationRate;
  const absoluteReduction = Number((origRate - mitigatedRate).toFixed(4));
  const relativeReductionPercentage = origRate > 0
    ? Number((((origRate - mitigatedRate) / origRate) * 100).toFixed(1))
    : 0;

  return {
    original: {
      answer: origGeneration.answer,
      hallucinationRate: origRate,
      hallucinationPercentage: (origRate * 100).toFixed(1) + '%',
      claims: origDetection.claimCheck.claims
    },
    mitigated: {
      answer: mitigatedGen.answer,
      hallucinationRate: mitigatedRate,
      hallucinationPercentage: (mitigatedRate * 100).toFixed(1) + '%',
      claims: mitigatedDetection.claimCheck.claims,
      provider: mitigatedGen.provider,
      latencyMs: mitigatedGen.latencyMs
    },
    delta: {
      absoluteReduction,
      relativeReductionPercentage,
      status: mitigatedRate < origRate ? 'HALLUCINATION_REDUCED' : 'SUSTAINED_GROUNDING'
    }
  };
}
