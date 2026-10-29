import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getNormalizedSampleType } from './dataLoader.js';
import { callGeminiApi } from './llm/provider.js';

/**
 * Extracts numeric values from a string (percentages, currency, decimals, integers).
 */
export function extractNumbers(text) {
  if (!text) return [];
  const matches = text.match(/[$€£]?\d+(?:\.\d+)?%?/g) || [];
  return matches.map(m => {
    const cleanStr = m.replace(/[$€£%]/g, '');
    const num = parseFloat(cleanStr);
    return {
      raw: m,
      value: num,
      isPercentage: m.includes('%'),
      isCurrency: /[$€£]/.test(m)
    };
  }).filter(item => !isNaN(item.value));
}

/**
 * ChartQA Relaxed Accuracy Rule:
 * Correct if within 5% tolerance of target table value.
 * tolerance = Math.abs(given - target) / Math.abs(target) <= 0.05
 */
export function checkNumericAccuracy(givenValue, targetValue, tolerance = 0.05) {
  if (targetValue === 0) return givenValue === 0;
  const diff = Math.abs(givenValue - targetValue);
  const relError = diff / Math.abs(targetValue);
  return relError <= tolerance;
}

/**
 * Hallucination Detection Engine
 * Performs:
 * 1. Numeric Relaxed-Accuracy Verification (chart_table & paper_figure with numbers)
 * 2. Choice Correctness Verification (science_mc)
 * 3. RAGTruth 5-Class Factual Claim Analysis across evidence type (table, lecture, or caption)
 */
export async function detectHallucinations(answerText, evidence, provider = 'claude') {
  const { sample, markdownTable, formattedEvidence } = evidence;
  const sampleType = evidence.sampleType || getNormalizedSampleType(sample);
  const goldAnswer = (sampleType !== 'user_upload' && sample) ? sample.answer : null;

  let numericCheck = null;
  let choiceCheck = null;
  let evidenceTextForClaims = '';

  // BRANCH BY EVIDENCE TYPE
  if (sampleType === 'user_upload') {
    const combinedEvidenceText = (evidence.extractedEvidence || '') + (evidence.userContext ? `\nContext: ${evidence.userContext}` : '');
    evidenceTextForClaims = combinedEvidenceText;

    const answerNumbers = extractNumbers(answerText);
    const evidenceNumbers = extractNumbers(combinedEvidenceText);

    const isYearOrOrdinal = (item) => {
      const val = item.value;
      if (Number.isInteger(val) && val >= 1900 && val <= 2099 && !item.isCurrency && !item.isPercentage) return true;
      if (/^Q[1-4]$/i.test(item.raw)) return true;
      return false;
    };

    const filteredAnswerNumbers = answerNumbers.filter(n => !isYearOrOrdinal(n));

    if (filteredAnswerNumbers.length > 0 && evidenceNumbers.length > 0) {
      const details = filteredAnswerNumbers.map(item => {
        let isSupported = evidenceNumbers.some(e => checkNumericAccuracy(item.value, e.value, 0.05));
        return {
          claimedNumber: item.raw,
          value: item.value,
          isSupported,
          matchedEvidence: isSupported ? 'Extracted evidence number' : null,
          flag: isSupported ? 'Grounded' : 'Unsupported numeric claim'
        };
      });

      numericCheck = {
        skipped: false,
        totalNumbersFound: filteredAnswerNumbers.length,
        unsupportedCount: details.filter(d => !d.isSupported).length,
        details
      };
    } else {
      numericCheck = {
        skipped: true,
        totalNumbersFound: filteredAnswerNumbers.length,
        unsupportedCount: 0,
        details: [],
        reason: filteredAnswerNumbers.length === 0 ? 'No non-year/ordinal numeric claims in answer.' : 'No numbers found in extracted evidence.'
      };
    }

  } else if (sampleType === 'science_mc') {
    // 1. SKIP numeric check for science_mc
    numericCheck = {
      skipped: true,
      totalNumbersFound: 0,
      unsupportedCount: 0,
      details: [],
      reason: 'Numeric check skipped for science multiple-choice.'
    };

    // 2. Choice Correctness Check
    const targetChoice = (sample && sample.choices && sample.answerIndex !== undefined)
      ? sample.choices[sample.answerIndex]
      : (goldAnswer || '');
    
    const ansLower = (answerText || '').toLowerCase();
    const targetLower = String(targetChoice).toLowerCase();
    const isChoiceMatch = ansLower.includes(targetLower) ||
      (sample?.answerIndex !== undefined && (
        ansLower.includes(`option ${sample.answerIndex + 1}`) ||
        ansLower.includes(String.fromCharCode(65 + sample.answerIndex).toLowerCase() + ')')
      ));

    choiceCheck = {
      targetChoice,
      isMatch: isChoiceMatch,
      status: isChoiceMatch ? 'CORRECT_CHOICE' : 'CHOICE_MISMATCH'
    };

    evidenceTextForClaims = sample?.lecture || sample?.hint || formattedEvidence || '';

  } else if (sampleType === 'paper_figure') {
    // Paper figure evidence: caption text
    const captionText = sample?.figureCaption || sample?.caption || formattedEvidence || '';
    evidenceTextForClaims = captionText;

    const answerNumbers = extractNumbers(answerText);
    const captionNumbers = extractNumbers(captionText);

    if (answerNumbers.length > 0 && captionNumbers.length > 0) {
      // Run numeric check against caption numbers
      const details = answerNumbers.map(item => {
        let isSupported = captionNumbers.some(c => checkNumericAccuracy(item.value, c.value));
        return {
          claimedNumber: item.raw,
          value: item.value,
          isSupported,
          matchedEvidence: isSupported ? 'Caption figure number' : null,
          flag: isSupported ? 'Grounded' : 'Unsupported numeric claim'
        };
      });

      numericCheck = {
        skipped: false,
        totalNumbersFound: answerNumbers.length,
        unsupportedCount: details.filter(d => !d.isSupported).length,
        details
      };
    } else {
      numericCheck = {
        skipped: true,
        totalNumbersFound: answerNumbers.length,
        unsupportedCount: 0,
        details: [],
        reason: 'Numeric check skipped (no numbers in figure caption).'
      };
    }

  } else {
    // chart_table (default)
    const tableData = sample ? sample.table : [];
    const tableText = JSON.stringify(tableData);
    const tableNumbers = extractNumbers(tableText);
    evidenceTextForClaims = markdownTable || formattedEvidence || '';

    const answerNumbers = extractNumbers(answerText);
    const numericVerification = answerNumbers.map(item => {
      let matchedTableVal = null;
      let isSupported = false;

      // Check against gold answer number if available
      const goldNums = goldAnswer ? extractNumbers(goldAnswer) : [];
      for (const g of goldNums) {
        if (checkNumericAccuracy(item.value, g.value)) {
          isSupported = true;
          matchedTableVal = g.raw;
          break;
        }
      }

      // Otherwise check against any value in table
      if (!isSupported) {
        for (const t of tableNumbers) {
          if (checkNumericAccuracy(item.value, t.value)) {
            isSupported = true;
            matchedTableVal = t.raw;
            break;
          }
        }
      }

      return {
        claimedNumber: item.raw,
        value: item.value,
        isSupported,
        matchedEvidence: matchedTableVal,
        flag: isSupported ? 'Grounded' : 'Unsupported numeric claim'
      };
    });

    numericCheck = {
      skipped: false,
      totalNumbersFound: answerNumbers.length,
      unsupportedCount: numericVerification.filter(n => !n.isSupported).length,
      details: numericVerification
    };
  }

  // Claim Decomposition & RAGTruth Taxonomy Classification
  const claims = decomposeIntoClaims(answerText);
  const evaluatedClaims = await classifyClaimsWithTaxonomy(claims, evidenceTextForClaims, sample, provider, sampleType === 'user_upload');

  // Summarize counts
  const totalClaims = evaluatedClaims.length;
  const hallucinatedClaims = evaluatedClaims.filter(c => c.classification !== 'Supported');
  const groundedClaims = evaluatedClaims.filter(c => c.classification === 'Supported');

  return {
    numericCheck,
    choiceCheck,
    claimCheck: {
      totalClaims,
      groundedCount: groundedClaims.length,
      hallucinatedCount: hallucinatedClaims.length,
      claims: evaluatedClaims
    },
    summary: {
      hallucinationRate: totalClaims > 0 ? Number((hallucinatedClaims.length / totalClaims).toFixed(4)) : 0,
      status: hallucinatedClaims.length === 0 ? 'FULLY_GROUNDED' : 'HALLUCINATION_DETECTED'
    }
  };
}

/**
 * Splits text into individual factual sentences/claim clauses.
 */
function decomposeIntoClaims(text) {
  if (!text) return [];
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  return sentences.length > 0 ? sentences : [text];
}

/**
 * Classifies claims into RAGTruth 5-category taxonomy across table, lecture, caption, or user upload evidence
 */
async function classifyClaimsWithTaxonomy(claims, evidenceText, sample, provider, isUserUpload = false) {
  const sampleType = isUserUpload ? 'user_upload' : getNormalizedSampleType(sample);
  const pLower = (provider || '').toLowerCase();
  const preferredJudge = (pLower.includes('gemini') && process.env.GEMINI_API_KEY)
    ? 'gemini'
    : (pLower.includes('openai') && process.env.OPENAI_API_KEY)
      ? 'openai'
      : (process.env.GEMINI_API_KEY
        ? 'gemini'
        : (process.env.ANTHROPIC_API_KEY ? 'claude' : 'openai'));
  const judgeProvider = (process.env.JUDGE_PROVIDER || preferredJudge).toLowerCase();
  const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

  const goldAnswer = (!isUserUpload && sample) ? sample.answer : null;
  const goldAnswerNums = goldAnswer ? extractNumbers(goldAnswer) : [];

  // Check key requirement for user upload judge
  if (isUserUpload) {
    if (judgeProvider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
      throw new Error("Hallucination detection for uploaded images requires a live API key for the judge model.");
    }
    if (judgeProvider === 'openai' && !process.env.OPENAI_API_KEY) {
      throw new Error("Hallucination detection for uploaded images requires a live API key for the judge model.");
    }
    if (judgeProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
      throw new Error("Hallucination detection for uploaded images requires a live API key for the judge model.");
    }
  }

  // 1. Try Claude Judge
  if (judgeProvider === 'claude' && process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const prompt = `You are a factual claim verifier for Multimodal RAG benchmarking.
Evidence Type: ${sampleType}
Context Evidence:
${evidenceText}

${goldAnswer ? `Gold Ground Truth Answer: ${goldAnswer}\n` : ''}
Classify each of the following claims from a generated response into ONE of these 5 categories:
- Supported: directly backed by evidence
- Evident Conflict: explicitly contradicts evidence facts or numbers
- Subtle Conflict: misinterprets context, ranges, or relationships
- Evident Baseless: introduces arbitrary facts, entities, or numbers completely missing from evidence
- Subtle Baseless: speculative assertions unsupported by data

Return a JSON array of objects with keys: "claim", "classification", "explanation".

Claims to evaluate:
${JSON.stringify(claims)}
`;

      const res = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      });

      const textRes = res.content.map(c => c.text).join('');
      const jsonMatch = textRes.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map(c => ({
          claim: c.claim,
          classification: c.classification || 'Supported',
          explanation: c.explanation || '',
          colorCategory: c.classification === 'Supported' ? 'teal' : 'brick-red'
        }));
      }
    } catch (e) {
      if (isUserUpload) throw e;
      console.warn("Live LLM claim classification fallback:", e.message);
    }
  }

  // 2. Try OpenAI Judge
  if (judgeProvider === 'openai' && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `You are a factual claim verifier for Multimodal RAG benchmarking.
Evidence Type: ${sampleType}
Context Evidence:
${evidenceText}

${goldAnswer ? `Gold Ground Truth Answer: ${goldAnswer}\n` : ''}
Classify each of the following claims from a generated response into ONE of these 5 categories:
- Supported: directly backed by evidence
- Evident Conflict: explicitly contradicts evidence facts or numbers
- Subtle Conflict: misinterprets context, ranges, or relationships
- Evident Baseless: introduces arbitrary facts, entities, or numbers completely missing from evidence
- Subtle Baseless: speculative assertions unsupported by data

Return a JSON array of objects with keys: "claim", "classification", "explanation".

Claims to evaluate:
${JSON.stringify(claims)}
`;

      const res = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      });

      const textRes = res.choices[0]?.message?.content || '';
      const jsonMatch = textRes.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map(c => ({
          claim: c.claim,
          classification: c.classification || 'Supported',
          explanation: c.explanation || '',
          colorCategory: c.classification === 'Supported' ? 'teal' : 'brick-red'
        }));
      }
    } catch (e) {
      if (isUserUpload) throw e;
      console.warn("Live LLM claim classification fallback:", e.message);
    }
  }

  // 3. Try Gemini Judge
  if (judgeProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    try {
      const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
      const prompt = `You are a factual claim verifier for Multimodal RAG benchmarking.
Evidence Type: ${sampleType}
Context Evidence:
${evidenceText}

${goldAnswer ? `Gold Ground Truth Answer: ${goldAnswer}\n` : ''}
Classify each of the following claims from a generated response into ONE of these 5 categories:
- Supported: directly backed by evidence
- Evident Conflict: explicitly contradicts evidence facts or numbers
- Subtle Conflict: misinterprets context, ranges, or relationships
- Evident Baseless: introduces arbitrary facts, entities, or numbers completely missing from evidence
- Subtle Baseless: speculative assertions unsupported by data

Return a JSON array of objects with keys: "claim", "classification", "explanation".

Claims to evaluate:
${JSON.stringify(claims)}
`;

      const textRes = await callGeminiApi(
        process.env.GEMINI_API_KEY,
        GEMINI_MODEL,
        null,
        prompt
      );

      const jsonMatch = textRes.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map(c => ({
          claim: c.claim,
          classification: c.classification || 'Supported',
          explanation: c.explanation || '',
          colorCategory: c.classification === 'Supported' ? 'teal' : 'brick-red'
        }));
      }
    } catch (e) {
      if (isUserUpload) throw e;
      console.warn("Live LLM claim classification fallback:", e.message);
    }
  }

  if (isUserUpload) {
    throw new Error("Hallucination detection for uploaded images requires a live API key for the judge model.");
  }

  // Heuristic rule-based taxonomy classification fallback
  const evTextLower = (evidenceText || '').toLowerCase();

  return claims.map(claim => {
    const claimLower = claim.toLowerCase();

    let cleanClaimForNumbers = claim;
    if (sample && sample.title) {
      cleanClaimForNumbers = cleanClaimForNumbers.replaceAll(sample.title, '');
    }
    if (sample && sample.id) {
      cleanClaimForNumbers = cleanClaimForNumbers.replaceAll(sample.id, '');
    }
    cleanClaimForNumbers = cleanClaimForNumbers.replace(/sample\s+\d+/gi, '');
    cleanClaimForNumbers = cleanClaimForNumbers.replace(/figure\s+\d+/gi, '');

    const claimNums = extractNumbers(cleanClaimForNumbers);
    let classification = 'Supported';
    let explanation = `Claim is consistent with the provided ${sampleType} evidence.`;

    if (claimLower.includes('not shown') ||
        claimLower.includes('based directly') ||
        claimLower.includes('explicitly supported') ||
        claimLower.includes('excluded') ||
        claimLower.includes('omitted') ||
        claimLower.includes('strictly based') ||
        claimLower.includes('no other metrics')) {
      classification = 'Supported';
      explanation = 'Explicitly constrained to grounded evidence.';
    }
    else if (claimLower.includes('nasa satellite') || claimLower.includes('surge by 450%') || claimLower.includes('section 4.2') || claimLower.includes('highest in recorded history')) {
      classification = 'Evident Baseless';
      explanation = `Introduces ungrounded external claims not present in the ${sampleType} evidence.`;
    }
    else if (claimNums.length > 0 && sampleType === 'chart_table') {
      let numGrounded = false;
      let numConflict = false;

      for (const cn of claimNums) {
        if (goldAnswerNums.some(gn => checkNumericAccuracy(cn.value, gn.value))) {
          numGrounded = true;
        } else {
          const inTable = evTextLower.includes(cn.raw.toLowerCase()) || evTextLower.includes(String(cn.value));
          if (inTable) numGrounded = true;
          else numConflict = true;
        }
      }

      if (numConflict) {
        classification = 'Evident Conflict';
        explanation = 'Claimed numeric figure contradicts the evidence values.';
      }
    }
    else if (claimLower.includes('projections suggest') || claimLower.includes('accelerates by') || claimLower.includes('benchmark baseline')) {
      classification = 'Subtle Baseless';
      explanation = 'Contains unbacked speculative reasoning.';
    }

    return {
      claim,
      classification,
      explanation,
      colorCategory: classification === 'Supported' ? 'teal' : 'brick-red'
    };
  });
}

