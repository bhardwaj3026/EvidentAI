import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { extractEvidenceFromImage, callGeminiApi } from './llm/provider.js';
import { detectHallucinations } from './detection.js';
import { extractAuthUser } from './auth.js';
import { checkAndConsumeChatQuota, saveUserSession } from './userStore.js';
import { extractDocumentText, isDocumentType } from './documentParser.js';

export const chatRouter = express.Router();

function detectRealImageType(buffer, declaredType = '', name = '') {
  if (!buffer || buffer.length < 4) return null;
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }
  if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    return 'application/msword';
  }
  const dt = (declaredType || '').toLowerCase();
  const nm = (name || '').toLowerCase();
  if (dt.includes('pdf') || nm.endsWith('.pdf')) return 'application/pdf';
  if (dt.includes('word') || dt.includes('docx') || nm.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (dt.includes('msword') || nm.endsWith('.doc')) return 'application/msword';
  return null;
}

function mapApiError(err) {
  const msg = err.message || '';
  const status = err.status || err.statusCode || 500;

  if (status === 401 || msg.includes('API key') || msg.includes('authentication') || msg.includes('unauthorized') || msg.includes('x-api-key')) {
    return { status: 401, message: "API key rejected or invalid. Please check your key in .env and restart the server." };
  }
  if (status === 404 || msg.includes('model') && msg.includes('not found')) {
    return { status: 404, message: "Model not found. Please check model configuration in .env and restart." };
  }
  if (status === 429 || msg.includes('rate limit') || msg.includes('quota') || msg.includes('credit')) {
    return { status: 429, message: "API rate limit reached or account quota exceeded. Please try again later." };
  }
  if (status === 400 || msg.includes('image') || msg.includes('unreadable') || msg.includes('format')) {
    return { status: 400, message: "The image payload could not be decoded or read by the AI provider." };
  }
  return { status, message: msg || "Failed to process chat request." };
}

// 1. GET /api/chat/status
chatRouter.get('/status', (req, res) => {
  res.json({
    success: true,
    claude: !!process.env.ANTHROPIC_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY
  });
});

// 2. POST /api/chat
chatRouter.post('/', async (req, res) => {
  try {
    const { messages, provider = 'gemini', strict = false, sessionId } = req.body;

    const authUser = extractAuthUser(req);
    let quotaInfo = null;
    if (authUser) {
      const quotaCheck = checkAndConsumeChatQuota(authUser.id);
      if (!quotaCheck.allowed) {
        return res.status(403).json({
          success: false,
          error: quotaCheck.error || "Chat limit reached for this account. Please reset your quota or switch accounts."
        });
      }
      quotaInfo = quotaCheck;
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: "Conversation messages array is required." });
    }
    if (messages.length > 20) {
      return res.status(400).json({ success: false, error: "Conversation exceeds maximum limit of 20 messages." });
    }

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user') {
      return res.status(400).json({ success: false, error: "The final message in the conversation must be from the user." });
    }

    // Validate and limit messages & images
    const processedMessages = [];
    const imageIndices = [];

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      let content = typeof m.content === 'string' ? m.content : '';
      if (content.length > 4000) {
        content = content.slice(0, 4000);
      }

      const item = { role, content };
      if (m.image && m.image.data) {
        item.image = {
          data: m.image.data,
          mediaType: m.image.mediaType,
          name: m.image.name || 'attachment',
          isDoc: !!m.image.isDoc
        };
        imageIndices.push(i);
      }
      processedMessages.push(item);
    }

    // Keep only the 4 most recent attachments
    if (imageIndices.length > 4) {
      const dropIndices = new Set(imageIndices.slice(0, imageIndices.length - 4));
      dropIndices.forEach(idx => {
        delete processedMessages[idx].image;
      });
    }

    // Validate remaining attachments and extract text if document
    for (const msg of processedMessages) {
      if (msg.image && msg.image.data) {
        const cleanBase64 = msg.image.data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');

        if (buffer.length > 25 * 1024 * 1024) {
          return res.status(400).json({ success: false, error: "Uploaded file exceeds 25 MB size limit." });
        }

        const realType = detectRealImageType(buffer, msg.image.mediaType, msg.image.name);
        if (!realType) {
          return res.status(400).json({ success: false, error: "The attached file format is invalid or unreadable." });
        }
        msg.image.mediaType = realType;
        msg.image.data = cleanBase64;

        if (isDocumentType(realType, msg.image.name)) {
          msg.image.isDoc = true;
          try {
            const extractedDocText = await extractDocumentText(buffer, realType, msg.image.name);
            if (extractedDocText) {
              msg.documentText = extractedDocText;
            }
          } catch (docErr) {
            console.warn("Document text extraction warning:", docErr.message);
          }
        }
      }
    }

    // Check API Keys & Provider Fallback
    const hasClaude = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;

    if (!hasClaude && !hasOpenAI && !hasGemini) {
      return res.status(400).json({
        success: false,
        error: "No API key found. Add GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY to the .env file and restart the server."
      });
    }

    let activeProvider = provider.toLowerCase();
    if (activeProvider === 'gemini' && !hasGemini) {
      activeProvider = hasClaude ? 'claude' : 'openai';
    } else if (activeProvider === 'claude' && !hasClaude) {
      activeProvider = hasGemini ? 'gemini' : 'openai';
    } else if (activeProvider === 'openai' && !hasOpenAI) {
      activeProvider = hasGemini ? 'gemini' : 'claude';
    }

    const systemPrompt = strict
      ? `You are an extremely strict Multimodal Image Assistant. Answer questions based strictly on the provided image(s).
FORMATTING RULES (MANDATORY):
1. For multiple-choice or objective conceptual questions:
**Correct Answer:** [Option Letter] [[Option Text]]
**Notes:**
[Concise explanation in 1-3 sentences based strictly on the image. Do NOT use raw LaTeX math code (e.g. no $ or $$). State relationships in plain text.]

Example:
**Correct Answer:** B [Both are inversely proportional]
**Notes:**
According to de Broglie, every object in motion has a wave character. As per de Broglie's relation, mass and wavelength are inversely proportional to each other.

2. For calculation, ratio, percentage, or numerical problems from charts or images:
**Correct Answer:** [Final result / ratio / value, e.g. 25 : 33 (or approximately 0.76 : 1)]

**Step-by-Step Calculation:**
1. Identify the values from the chart/evidence:
   • [Category 1] = [Value 1]
   • [Category 2] = [Value 2]
2. Set up the ratio / formula:
   Ratio = [Value 1] / [Value 2]
3. Simplify the fraction by eliminating decimals / common factors:
   [Clear arithmetic step]
4. Final simplified result:
   [Final reduced fraction or ratio]

**Notes:**
[Brief factual summary note based strictly on the image.]

3. For open-ended qualitative questions:
**Correct Answer:** [Direct concise answer]
**Notes:**
[Concise factual notes based strictly on the image.]

Rules:
- If details are not shown in the image, explicitly reply "Not shown in the image."
- Do NOT guess, extrapolate, or use outside knowledge. Never output raw LaTeX like $$ or $.`
      : `You are a helpful Multimodal AI Assistant solving image questions and exam problems.
FORMATTING RULES (MANDATORY):
1. For multiple-choice or objective conceptual questions:
**Correct Answer:** [Option Letter] [[Option Text]]
**Notes:**
[Concise conceptual explanation in 1-3 sentences explaining the core concept, law, or rule in plain text.]

Example:
**Correct Answer:** B [Both are inversely proportional]
**Notes:**
According to de Broglie, every object in motion has a wave character. As per de Broglie's relation, mass and wavelength are inversely proportional to each other.

2. For calculation, ratio, percentage, or numerical problems from charts or images:
The ratio / answer statement:
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

3. For other questions:
**Correct Answer:** [Direct concise answer]
**Notes:**
[Brief explanatory notes on the concept.]

Rules:
- IMPORTANT: NEVER output raw LaTeX syntax (such as $$...$$ or $...$ or \\frac or \\div). Express formulas and relations in clean, plain readable words or unicode (÷, ×, λ, ∝).
- Keep each section organized and clean.`;

    const startTime = Date.now();

    // 0. GEMINI PROVIDER
    if (activeProvider === 'gemini') {
      const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
      try {
        const lastMsg = processedMessages[processedMessages.length - 1];
        let userText = lastMsg.content || '';
        let mediaType = lastMsg.image?.mediaType;
        let base64Data = lastMsg.image?.data;

        // If a Word document or extracted text exists, prepend document text to user prompt
        if (lastMsg.documentText) {
          const docHeading = lastMsg.image?.name ? `[Attached Document: ${lastMsg.image.name}]` : '[Attached Document Content]';
          userText = `${docHeading}\n${lastMsg.documentText}\n\n${userText}`;
          // For Word docs, omit inline binary since Gemini inline_data only accepts image/* and application/pdf
          if (mediaType !== 'application/pdf') {
            mediaType = null;
            base64Data = null;
          }
        }

        const answerText = await callGeminiApi(
          process.env.GEMINI_API_KEY,
          GEMINI_MODEL,
          systemPrompt,
          userText,
          mediaType,
          base64Data
        );

        const elapsed = Date.now() - startTime;

        if (authUser) {
          const fullHistory = [...messages, { role: 'assistant', content: answerText }];
          const firstUserText = messages.find(m => m.role === 'user')?.content || 'Image Chat';
          const title = firstUserText.length > 36 ? firstUserText.slice(0, 36) + '...' : firstUserText;
          try {
            saveUserSession(authUser.id, {
              id: sessionId || req.headers['x-session-id'],
              title,
              messages: fullHistory
            });
          } catch (e) {
            console.warn('Could not auto-save session:', e.message);
          }
        }

        return res.json({
          success: true,
          answer: answerText,
          provider: 'Google Gemini',
          model: GEMINI_MODEL,
          latencyMs: elapsed,
          quota: quotaInfo
        });
      } catch (err) {
        const mapped = mapApiError(err);
        return res.status(mapped.status).json({ success: false, error: mapped.message });
      }
    }

    // 1. CLAUDE PROVIDER
    if (activeProvider === 'claude') {
      const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const formattedMessages = processedMessages.map(msg => {
        if (msg.role === 'user' && msg.image) {
          const contentParts = [];
          let userText = msg.content || 'Please analyze this attached file in detail.';
          if (msg.documentText) {
            const docName = msg.image.name || 'document';
            userText = `[Attached Document Content: ${docName}]\n${msg.documentText}\n\n${userText}`;
          }

          if (msg.image.mediaType === 'application/pdf') {
            contentParts.push({
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: msg.image.data
              }
            });
          } else if (msg.image.mediaType && msg.image.mediaType.startsWith('image/')) {
            contentParts.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: msg.image.mediaType,
                data: msg.image.data
              }
            });
          }
          contentParts.push({ type: 'text', text: userText });

          return {
            role: 'user',
            content: contentParts
          };
        }
        return {
          role: msg.role,
          content: msg.content || ''
        };
      });

      try {
        const response = await anthropic.messages.create({
          model: ANTHROPIC_MODEL,
          max_tokens: 1000,
          system: systemPrompt,
          messages: formattedMessages
        });

        const elapsed = Date.now() - startTime;
        const answerText = response.content.map(c => c.text).join('\n');

        return res.json({
          success: true,
          answer: answerText,
          provider: 'Claude',
          model: ANTHROPIC_MODEL,
          latencyMs: elapsed
        });
      } catch (err) {
        const mapped = mapApiError(err);
        return res.status(mapped.status).json({ success: false, error: mapped.message });
      }
    }

    // 2. OPENAI PROVIDER
    if (activeProvider === 'openai') {
      const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const formattedMessages = [
        { role: 'system', content: systemPrompt },
        ...processedMessages.map(msg => {
          if (msg.role === 'user' && msg.image) {
            const contentParts = [];
            let userText = msg.content || 'Please analyze this attached file in detail.';
            if (msg.documentText) {
              const docName = msg.image.name || 'document';
              userText = `[Attached Document Content: ${docName}]\n${msg.documentText}\n\n${userText}`;
            }
            contentParts.push({ type: 'text', text: userText });

            if (msg.image.mediaType && msg.image.mediaType.startsWith('image/')) {
              contentParts.push({
                type: 'image_url',
                image_url: { url: `data:${msg.image.mediaType};base64,${msg.image.data}` }
              });
            }

            return {
              role: 'user',
              content: contentParts
            };
          }
          return {
            role: msg.role,
            content: msg.content || ''
          };
        })
      ];

      try {
        const response = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          max_tokens: 1000,
          messages: formattedMessages
        });

        const elapsed = Date.now() - startTime;
        const answerText = response.choices[0]?.message?.content || '';

        return res.json({
          success: true,
          answer: answerText,
          provider: 'OpenAI',
          model: OPENAI_MODEL,
          latencyMs: elapsed
        });
      } catch (err) {
        const mapped = mapApiError(err);
        return res.status(mapped.status).json({ success: false, error: mapped.message });
      }
    }

  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error." });
  }
});

// 3. POST /api/chat/check (Hallucination Checker for Chat Answers)
chatRouter.post('/check', async (req, res) => {
  try {
    const { question = '', answer, image, provider = 'claude' } = req.body;

    if (!answer) {
      return res.status(400).json({ success: false, error: "Answer text is required for hallucination check." });
    }
    if (!image || !image.data) {
      return res.status(400).json({ success: false, error: "An image is required to run hallucination check." });
    }

    const cleanBase64 = image.data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const realType = detectRealImageType(buffer, image.mediaType, image.name);

    if (!realType) {
      return res.status(400).json({ success: false, error: "The attached file format is invalid or unreadable." });
    }

    const hasClaude = !!process.env.ANTHROPIC_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasGemini = !!process.env.GEMINI_API_KEY;

    if (!hasClaude && !hasOpenAI && !hasGemini) {
      return res.status(400).json({ success: false, error: "No API key found to run hallucination check. Add GEMINI_API_KEY to your .env file." });
    }

    let targetProvider = provider.toLowerCase();
    if (targetProvider === 'gemini' && !hasGemini) {
      targetProvider = hasClaude ? 'claude' : (hasOpenAI ? 'openai' : 'gemini');
    } else if (targetProvider === 'claude' && !hasClaude) {
      targetProvider = hasGemini ? 'gemini' : (hasOpenAI ? 'openai' : 'claude');
    } else if (targetProvider === 'openai' && !hasOpenAI) {
      targetProvider = hasGemini ? 'gemini' : (hasClaude ? 'claude' : 'openai');
    }

    // Step 1: Transcribe / extract evidence
    let extractedEvidence = '';
    const isDoc = isDocumentType(realType, image.name);
    try {
      if (isDoc) {
        extractedEvidence = await extractDocumentText(buffer, realType, image.name);
        if (!extractedEvidence && realType === 'application/pdf') {
          extractedEvidence = await extractEvidenceFromImage(targetProvider, realType, cleanBase64);
        }
      } else {
        extractedEvidence = await extractEvidenceFromImage(targetProvider, realType, cleanBase64);
      }
    } catch (extErr) {
      return res.status(400).json({ success: false, error: extErr.message });
    }

    // Step 2: Hallucination Detection
    const evidenceBlock = {
      sample: null,
      sampleType: 'user_upload',
      extractedEvidence,
      userContext: question,
      formattedEvidence: extractedEvidence,
      base64Image: cleanBase64,
      mediaType: realType
    };

    const detectionResult = await detectHallucinations(answer, evidenceBlock, targetProvider);

    return res.json({
      success: true,
      status: detectionResult.summary.status,
      hallucinationRate: detectionResult.summary.hallucinationRate,
      claims: detectionResult.claimCheck.claims,
      totalClaims: detectionResult.claimCheck.totalClaims,
      hallucinatedCount: detectionResult.claimCheck.hallucinatedCount,
      numericCheck: detectionResult.numericCheck
    });

  } catch (err) {
    console.error("Chat check error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to run hallucination check." });
  }
});
