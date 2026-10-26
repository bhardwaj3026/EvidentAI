import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { formatEvidenceForPrompt, getNormalizedSampleType } from '../dataLoader.js';
import { extractDocumentText, isDocumentType } from '../documentParser.js';

/**
 * Reads image file from disk and encodes as base64 string.
 */
export function getBase64Image(imagePath) {
  try {
    const fullPath = path.isAbsolute(imagePath)
      ? imagePath
      : path.join(process.cwd(), imagePath.replace(/^\//, ''));
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath);
      return buffer.toString('base64');
    }
  } catch (e) {
    console.error(`Failed to encode image at ${imagePath}:`, e.message);
  }
  return null;
}

/**
 * Helper to call Google Gemini API directly via REST
 */
export async function callGeminiApi(apiKey, model, systemPrompt, userText, mediaType, base64Data) {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error("Missing GEMINI_API_KEY in .env. Please add your GEMINI_API_KEY to the .env file.");
  }

  const primaryModel = model || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const candidateModels = Array.from(new Set([
    primaryModel,
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.8-flash'
  ]));

  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey.trim()}`;

      const parts = [];
      if (base64Data) {
        parts.push({
          inline_data: {
            mime_type: mediaType || 'image/png',
            data: base64Data
          }
        });
      }
      const fullText = systemPrompt ? `System Instructions:\n${systemPrompt}\n\n${userText}` : userText;
      parts.push({ text: fullText || 'Analyze this input.' });

      const body = { contents: [{ parts }] };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message || `Gemini API call failed with status ${res.status}`;
        const errLower = errMsg.toLowerCase();
        const isRetryable = res.status === 429 || res.status === 503 || res.status === 500 || res.status === 404 ||
          errLower.includes('high demand') ||
          errLower.includes('capacity') ||
          errLower.includes('unavailable') ||
          errLower.includes('quota') ||
          errLower.includes('rate limit');
        lastError = new Error(`Gemini API Error: ${errMsg}`);
        if (isRetryable && candidateModels.indexOf(modelName) < candidateModels.length - 1) {
          console.warn(`Gemini model ${modelName} returned temporary error: ${errMsg}. Trying fallback model...`);
          continue;
        }
        throw lastError;
      }

      return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    } catch (err) {
      lastError = err;
      const errLower = err.message.toLowerCase();
      const isRetryable = errLower.includes('high demand') || errLower.includes('capacity') || errLower.includes('unavailable') || errLower.includes('429') || errLower.includes('503') || errLower.includes('not_found') || errLower.includes('quota');
      if (candidateModels.indexOf(modelName) < candidateModels.length - 1 && isRetryable) {
        console.warn(`Retrying with fallback Gemini model after error: ${err.message}`);
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("Gemini API call failed across all candidate models.");
}

/**
 * Transcribes text, numbers, and tables from an uploaded document or image via parser or Vision model.
 */
export async function extractEvidenceFromImage(provider, mediaType, base64Data, fileName = '') {
  if (isDocumentType(mediaType, fileName)) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const docText = await extractDocumentText(buffer, mediaType, fileName);
      if (docText) return docText;
    } catch (e) {
      console.warn('Document text extraction fallback:', e.message);
    }
  }

  const promptText = "Transcribe everything visible in this document or image: all text, labels, axis titles, legends, numbers, and any data table, as plain structured text.";
  const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Gemini provider selected but GEMINI_API_KEY is missing in .env.");
    }
    return await callGeminiApi(process.env.GEMINI_API_KEY, GEMINI_MODEL, null, promptText, mediaType, base64Data);
  }

  if (provider === 'claude') {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Document upload requires a live API key for the selected provider.");
    }
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const contentBlock = mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: base64Data } };

    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          { type: 'text', text: promptText }
        ]
      }]
    });
    return response.content.map(c => c.text).join('\n');
  } else {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Document upload requires a live API key for the selected provider.");
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: promptText },
            ...(mediaType && mediaType.startsWith('image/') ? [{
              type: 'image_url',
              image_url: { url: `data:${mediaType || 'image/png'};base64,${base64Data}` }
            }] : [])
          ]
        }
      ]
    });
    return response.choices[0]?.message?.content || '';
  }
}

/**
 * Provider-agnostic LLM Answer Generation Interface
 * @param {string} provider - 'claude' | 'openai' | 'gemini'
 * @param {object} evidence - { sample, formattedEvidence, markdownTable, imagePath, base64Image, mediaType, sampleType }
 * @param {string} question - Question prompt
 * @param {object} options - { isMitigationMode: boolean }
 */
export async function generateAnswer(provider, evidence, question, options = {}) {
  const { sample, markdownTable, imagePath } = evidence;
  const isMitigationMode = options.isMitigationMode || false;
  const sampleType = evidence.sampleType || getNormalizedSampleType(sample);
  const formattedEvidence = evidence.formattedEvidence || (sample ? formatEvidenceForPrompt(sample) : markdownTable) || '';

  const mediaType = evidence.mediaType || 'image/png';
  const base64Image = evidence.base64Image || (imagePath ? getBase64Image(imagePath) : null);

  const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
  const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  const pLower = (provider || '').toLowerCase();
  const normalizedProvider = pLower.includes('gemini')
    ? 'gemini'
    : (pLower.includes('openai') || pLower.includes('gpt') ? 'openai' : 'claude');

  // Strict check for user uploads: require live API key, no heuristic fallback
  if (sampleType === 'user_upload') {
    if (normalizedProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
      throw new Error("Image upload requires a live GEMINI_API_KEY in .env.");
    }
    if (normalizedProvider === 'claude' && !process.env.ANTHROPIC_API_KEY) {
      throw new Error("Image upload requires a live ANTHROPIC_API_KEY in .env.");
    }
    if (normalizedProvider === 'openai' && !process.env.OPENAI_API_KEY) {
      throw new Error("Image upload requires a live OPENAI_API_KEY in .env.");
    }
  }

  let systemPrompt = '';
  if (sampleType === 'user_upload') {
    systemPrompt = isMitigationMode
      ? `You are an extremely strict Multimodal Image Analyst.
Answer questions based strictly on what is directly visible in the image.
FORMATTING RULES (MANDATORY):
1. For multiple-choice or objective conceptual questions:
**Correct Answer:** [Option Letter] [[Option Text]]
**Notes:**
[Concise explanation in 1-3 sentences based strictly on the image. Do NOT use raw LaTeX math code (e.g. no $ or $$).]

2. For calculation, ratio, percentage, or numerical problems from charts or images:
**Correct Answer:** [Final result / ratio / value, e.g. 25 : 33 (or approximately 0.76 : 1)]

**Step-by-Step Calculation:**
1. Identify the percentages / values from the image:
   • [Category 1] = [Value 1]
   • [Category 2] = [Value 2]
2. Set up the ratio / formula:
   Ratio = [Value 1] / [Value 2]
3. Simplify the fraction by eliminating decimals:
   [e.g. 125 / 165]
4. Divide by the common factor:
   (125 ÷ 5) / (165 ÷ 5) = 25 / 33

**Notes:**
[Brief factual summary note based strictly on the image.]

3. For open-ended questions:
**Correct Answer:** [Direct answer]
**Notes:**
[Concise factual notes based strictly on the image.]

Rules:
1. State only facts directly supported by the image or extracted evidence.
2. If details are not shown in the image, explicitly state "not shown in the image".
3. Keep the answer concise, factual, and precise. Never use raw LaTeX like $$ or $.`
      : `You are a helpful Multimodal AI Assistant analyzing an uploaded image.
FORMATTING RULES (MANDATORY):
1. For multiple-choice or objective conceptual questions:
**Correct Answer:** [Option Letter] [[Option Text]]
**Notes:**
[Concise conceptual explanation in 1-3 sentences in plain words. Do NOT use raw LaTeX math code (e.g. no $ or $$).]

Example:
**Correct Answer:** B [Both are inversely proportional]
**Notes:**
According to de Broglie, every object in motion has a wave character. As per de Broglie's relation, mass and wavelength are inversely proportional to each other.

2. For calculation, ratio, percentage, or numerical problems from charts or images:
**Correct Answer:** [Final result / ratio / value, e.g. 25 : 33 (or approximately 0.76 : 1)]

**Step-by-Step Calculation:**
1. Identify the percentages / values from the chart/evidence:
   • [Category 1] = [Value 1]
   • [Category 2] = [Value 2]
2. Set up the ratio / calculation:
   Ratio = [Value 1] / [Value 2]
3. Simplify the fraction by multiplying numerator and denominator to eliminate decimals:
   [e.g. 125 / 165]
4. Divide by the common factor:
   (125 ÷ 5) / (165 ÷ 5) = 25 / 33

**Notes:**
[Brief explanatory note on the result.]

3. For open-ended questions:
**Correct Answer:** [Direct answer]
**Notes:**
[Concise notes explaining the answer.]

Rules:
- NEVER use raw LaTeX syntax (such as $$...$$, $...$, \\frac, \\div). Express formulas in clean, plain readable words or unicode (÷, ×, λ, ∝).
Answer the user's question accurately based on the image and extracted evidence context.`;
  } else if (sampleType === 'science_mc') {
    systemPrompt = isMitigationMode
      ? `You are an extremely strict Science Multiple Choice Analyst.
Pick one of the given options AND justify it using ONLY the lecture text.
FORMATTING RULES (MANDATORY):
**Correct Answer:** [Option Letter] [[Option Text]]
**Notes:**
[Concise conceptual explanation in 1-3 sentences based strictly on the lecture. Do NOT use raw LaTeX math code (e.g. no $ or $$).]

Example:
**Correct Answer:** B [Both are inversely proportional]
**Notes:**
According to de Broglie, every object in motion has a wave character. As per de Broglie's relation, mass and wavelength are inversely proportional to each other.

Rules:
1. Base your selection and explanation strictly on the provided lecture and image.
2. If the lecture doesn't cover something, say so rather than adding outside knowledge.
3. State your choice clearly and keep explanations strictly grounded.`
      : `You are a helpful Multimodal AI Assistant solving science questions.
FORMATTING RULES (MANDATORY):
**Correct Answer:** [Option Letter] [[Option Text]]
**Notes:**
[Concise conceptual explanation in 1-3 sentences explaining the core concept. Do NOT use raw LaTeX math code (e.g. no $ or $$).]

Example:
**Correct Answer:** B [Both are inversely proportional]
**Notes:**
According to de Broglie, every object in motion has a wave character. As per de Broglie's relation, mass and wavelength are inversely proportional to each other.

Pick one of the given options AND justify your answer using ONLY the lecture text provided.`;
  } else if (sampleType === 'paper_figure') {
    systemPrompt = isMitigationMode
      ? `You are an extremely strict Academic Figure Analyst.
Answer the user's question using ONLY the provided figure and caption.
FORMATTING RULES (MANDATORY):
**Correct Answer:** [Direct answer]
**Notes:**
[Concise factual notes based strictly on the figure and caption. Do NOT use raw LaTeX math code (e.g. no $ or $$).]
Rules:
1. State only facts directly supported by the figure and caption.
2. If details are not shown in the figure or caption, state "not shown in the figure" rather than guessing about paper content not given.
3. Keep the answer concise and precise.`
      : `You are a helpful Multimodal AI Assistant analyzing research paper figures.
FORMATTING RULES (MANDATORY):
**Correct Answer:** [Direct answer]
**Notes:**
[Concise factual notes based on the figure and caption. Do NOT use raw LaTeX math code (e.g. no $ or $$).]
Answer the question using ONLY the figure and caption provided, and say "not shown in the figure" rather than guessing about paper content not given.`;
  } else {
    systemPrompt = isMitigationMode
      ? `You are an extremely strict, factual Multimodal RAG Analyst.
Answer the user's question based strictly and ONLY on the provided chart data table and image.
FORMATTING RULES (MANDATORY):
1. For calculation, ratio, percentage, or numerical problems:
**Correct Answer:** [Final result / ratio / value, e.g. 25 : 33 (or approximately 0.76 : 1)]

**Step-by-Step Calculation:**
1. Identify the values / percentages from the table/chart:
   • [Category 1] = [Value 1]
   • [Category 2] = [Value 2]
2. Set up the calculation / ratio:
   Ratio = [Value 1] / [Value 2]
3. Simplify the calculation / fraction:
   [Intermediate step]
4. Final simplified result:
   [Final reduced fraction or value]

**Notes:**
[Brief factual summary note based strictly on the table.]

2. For direct lookup questions:
**Correct Answer:** [Direct answer]
**Notes:**
[Concise factual notes based strictly on the table and chart. Do NOT use raw LaTeX math code (e.g. no $ or $$).]
Rules:
1. State only facts directly verified in the table/image.
2. If a value or metric is not present in the table, explicitly state "Not shown in evidence".
3. Do NOT extrapolate, speculate, or introduce unverified figures.
4. Keep the answer concise and precise.`
      : `You are a helpful Multimodal AI Assistant analyzing chart data.
FORMATTING RULES (MANDATORY):
1. For calculation, ratio, percentage, or numerical problems:
**Correct Answer:** [Final result / ratio / value, e.g. 25 : 33 (or approximately 0.76 : 1)]

**Step-by-Step Calculation:**
1. Identify the values / percentages from the table/chart:
   • [Category 1] = [Value 1]
   • [Category 2] = [Value 2]
2. Set up the calculation / ratio:
   Ratio = [Value 1] / [Value 2]
3. Simplify the calculation / fraction:
   [Intermediate step]
4. Final simplified result:
   [Final reduced fraction or value]

**Notes:**
[Brief explanatory notes on the result.]

2. For direct lookup questions:
**Correct Answer:** [Direct answer]
**Notes:**
[Concise factual notes based on the chart and table. Do NOT use raw LaTeX math code (e.g. no $ or $$).]
Rules:
- Do NOT use raw LaTeX math code (e.g. no $ or $$). Express formulas in clean, plain readable words or unicode (÷, ×).
Answer the user's question clearly based on the provided chart table and image context.`;
  }

  const userContentText = `Context Evidence (${sampleType}):\n${formattedEvidence}\n\nQuestion: ${question}\n\nPlease provide a clear, factual answer.`;

  // 0. Check for Gemini API key & selected provider
  if (normalizedProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    try {
      const startTime = Date.now();
      const answerText = await callGeminiApi(
        process.env.GEMINI_API_KEY,
        GEMINI_MODEL,
        systemPrompt,
        userContentText,
        mediaType,
        base64Image
      );
      const elapsed = Date.now() - startTime;
      return {
        provider: `Google Gemini (${GEMINI_MODEL})`,
        answer: answerText,
        latencyMs: elapsed,
        raw: { model: GEMINI_MODEL },
        mode: 'live_api'
      };
    } catch (err) {
      if (sampleType === 'user_upload') throw err;
      console.warn(`Gemini API call failed: ${err.message}. Falling back to heuristic provider.`);
    }
  }

  // 1. Check for Anthropic API key & selected provider
  if (normalizedProvider === 'claude' && process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const contentPayload = [];

      if (base64Image) {
        contentPayload.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Image
          }
        });
      }

      contentPayload.push({
        type: 'text',
        text: userContentText
      });

      const startTime = Date.now();
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: contentPayload }]
      });

      const elapsed = Date.now() - startTime;
      const answerText = response.content.map(c => c.text).join('\n');

      return {
        provider: `Claude (${ANTHROPIC_MODEL})`,
        answer: answerText,
        latencyMs: elapsed,
        raw: response,
        mode: 'live_api'
      };
    } catch (err) {
      if (sampleType === 'user_upload') throw err;
      console.warn(`Claude API call failed: ${err.message}. Falling back to heuristic provider.`);
    }
  }

  // 2. Check for OpenAI API key & selected provider
  if (normalizedProvider === 'openai' && process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const contentPayload = [];

      contentPayload.push({ type: 'text', text: userContentText });

      if (base64Image) {
        contentPayload.push({
          type: 'image_url',
          image_url: {
            url: `data:${mediaType};base64,${base64Image}`
          }
        });
      }

      const startTime = Date.now();
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 500,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contentPayload }
        ]
      });

      const elapsed = Date.now() - startTime;
      const answerText = response.choices[0]?.message?.content || '';

      return {
        provider: `OpenAI (${OPENAI_MODEL})`,
        answer: answerText,
        latencyMs: elapsed,
        raw: response,
        mode: 'live_api'
      };
    } catch (err) {
      if (sampleType === 'user_upload') throw err;
      console.warn(`OpenAI API call failed: ${err.message}. Falling back to heuristic provider.`);
    }
  }

  if (sampleType === 'user_upload') {
    throw new Error("Image upload requires a live API key for the selected provider.");
  }

  // 3. Fallback / Heuristic Generation (For testing/demo when API keys are not supplied)
  return runHeuristicProvider(provider, sample, question, isMitigationMode);
}

/**
 * Intelligent Heuristic Generation Engine
 */
function runHeuristicProvider(provider, sample, question, isMitigationMode) {
  const providerLabel = provider === 'claude' ? 'Claude 3.5 Sonnet (Simulated)' : 'GPT-4o (Simulated)';
  const sampleType = getNormalizedSampleType(sample);
  const goldAnswer = sample ? sample.answer : 'Target Answer';
  const sampleTitle = sample ? sample.title : 'Evidence Item';

  if (isMitigationMode) {
    if (sampleType === 'science_mc') {
      return {
        provider: providerLabel + ' [Mitigated]',
        answer: `Based directly on the lecture text for "${sampleTitle}", the correct option is ${goldAnswer}. Additional unverified hypotheses are omitted as not covered in the lecture.`,
        latencyMs: 310,
        raw: { simulated: true, note: 'Strict lecture-constrained mitigation' },
        mode: 'heuristic_simulated'
      };
    } else if (sampleType === 'paper_figure') {
      return {
        provider: providerLabel + ' [Mitigated]',
        answer: `Based strictly on the figure and caption for "${sampleTitle}", ${goldAnswer}. Any details regarding overall paper sections not shown in the figure are omitted.`,
        latencyMs: 290,
        raw: { simulated: true, note: 'Strict figure-caption constrained mitigation' },
        mode: 'heuristic_simulated'
      };
    } else {
      return {
        provider: providerLabel + ' [Mitigated]',
        answer: `Based directly on the evidence table for "${sampleTitle}", the answer to your question is ${goldAnswer}. All other metrics not shown in the chart are excluded.`,
        latencyMs: 320,
        raw: { simulated: true, note: 'Strictly evidence-constrained mitigation pass' },
        mode: 'heuristic_simulated'
      };
    }
  }

  // Deterministic hallucination triggering for testing taxonomy across all datasets
  let hasHallucination = false;
  if (sample && sample.id) {
    const numPart = parseInt(sample.id.replace(/\D/g, ''), 10);
    hasHallucination = !isNaN(numPart) ? (numPart % 3 === 0) : false;
  }

  let text = '';
  if (sampleType === 'science_mc') {
    text = `For "${sampleTitle}", the correct choice is ${goldAnswer}. `;
    if (hasHallucination) {
      text += `Furthermore, NASA satellite telemetry confirms this molecular reaction accelerates by 450% in zero gravity environments.`;
    } else {
      text += `This is explicitly supported by the lecture background material.`;
    }
  } else if (sampleType === 'paper_figure') {
    text = `Analyzing the figure in "${sampleTitle}", ${goldAnswer}. `;
    if (hasHallucination) {
      text += `Additionally, Section 4.2 of the paper demonstrates a 99.8% F1 score across all benchmark baseline models.`;
    } else {
      text += `This conclusion is directly depicted in the figure and detailed in its caption.`;
    }
  } else {
    text = `Based on the provided chart titled "${sampleTitle}", `;
    if (hasHallucination) {
      text += `the value for the queried category is ${goldAnswer}. `;
      text += `Additionally, global industry projections suggest this figure will surge by 450% next quarter to $24.5B, making it the highest in recorded history.`;
    } else {
      text += `the target value for the category in question is ${goldAnswer}, which accurately reflects the figures listed in the data table.`;
    }
  }

  return {
    provider: providerLabel,
    answer: text,
    latencyMs: 250,
    raw: { simulated: true },
    mode: 'heuristic_simulated'
  };
}

