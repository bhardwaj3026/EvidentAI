import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import crypto from 'crypto';

import { getAllDatasets, getDatasetSamples, getSampleById, formatTableToMarkdown, formatEvidenceForPrompt, getNormalizedSampleType } from './server/dataLoader.js';
import { retrieveEvidence } from './server/retrieval.js';
import { generateAnswer, getBase64Image, extractEvidenceFromImage } from './server/llm/provider.js';
import { detectHallucinations, checkNumericAccuracy, extractNumbers } from './server/detection.js';
import { sessionTracker } from './server/quantification.js';
import { runMitigationPass } from './server/mitigation.js';
import { chatRouter } from './server/chat.js';
import { authRouter, extractAuthUser } from './server/auth.js';
import { checkAndConsumeChatQuota } from './server/userStore.js';
import { extractDocumentText, isDocumentType } from './server/documentParser.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', authRouter);
app.use('/api/chat', chatRouter);

// In-Memory Upload Store (10-minute TTL, max 100 entries)
const uploadStore = new Map();
const UPLOAD_TTL_MS = 10 * 60 * 1000;
const MAX_UPLOADS = 100;

function cleanupUploadStore() {
  const now = Date.now();
  for (const [id, entry] of uploadStore.entries()) {
    if (now - entry.createdAt > UPLOAD_TTL_MS) {
      uploadStore.delete(id);
    }
  }
  if (uploadStore.size > MAX_UPLOADS) {
    const oldestId = uploadStore.keys().next().value;
    uploadStore.delete(oldestId);
  }
}

function validateUploadedImage(uploadedImage) {
  if (!uploadedImage || typeof uploadedImage !== 'object') {
    throw new Error("Invalid uploadedImage object.");
  }
  const allowedMediaTypes = [
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  const { mediaType, data, name = '' } = uploadedImage;

  const isAllowed = mediaType && (
    allowedMediaTypes.includes(mediaType.toLowerCase()) ||
    mediaType.includes('pdf') ||
    mediaType.includes('word') ||
    mediaType.includes('officedocument') ||
    name.toLowerCase().endsWith('.pdf') ||
    name.toLowerCase().endsWith('.docx') ||
    name.toLowerCase().endsWith('.doc')
  );

  if (!isAllowed) {
    throw new Error(`Invalid file type '${mediaType}'. Allowed types: Images (PNG, JPEG, WebP, GIF), PDF, and Word documents (.docx, .doc).`);
  }

  if (!data || typeof data !== 'string') {
    throw new Error("Missing file data.");
  }

  const cleanBase64 = data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');

  if (buffer.length > 25 * 1024 * 1024) {
    throw new Error("Uploaded file exceeds maximum size of 25 MB.");
  }
  if (buffer.length === 0) {
    throw new Error("Uploaded file data is empty.");
  }

  const isPng = buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isGif = buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38;
  const isWebp = buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  const isPdf = buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  const isDocx = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const isDoc = buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;

  let realMediaType = isPng ? 'image/png' : isJpeg ? 'image/jpeg' : isGif ? 'image/gif' : isWebp ? 'image/webp' : isPdf ? 'application/pdf' : isDocx ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : isDoc ? 'application/msword' : null;

  if (!realMediaType) {
    if (name.toLowerCase().endsWith('.pdf') || (mediaType && mediaType.includes('pdf'))) {
      realMediaType = 'application/pdf';
    } else if (name.toLowerCase().endsWith('.docx') || (mediaType && (mediaType.includes('docx') || mediaType.includes('word')))) {
      realMediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (name.toLowerCase().endsWith('.doc') || (mediaType && mediaType.includes('msword'))) {
      realMediaType = 'application/msword';
    } else {
      throw new Error("File magic bytes verification failed. The uploaded file is not a valid Image, PDF, or Word document.");
    }
  }

  return { mediaType: realMediaType, cleanBase64, name };
}

// Main entrypoint: Serve Unified Multimodal Platform at root '/'
app.get(['/', '/showcase', '/lab', '/chat', '/analytics', '/index.html'], (req, res) => {
  res.sendFile(path.join(process.cwd(), 'chat.html'));
});

// Serve static frontend files (without defaulting to index.html)
app.use(express.static(process.cwd(), { index: false }));
app.use('/data', express.static(path.join(process.cwd(), 'data')));

// ============================================================================
// API ENDPOINTS
// ============================================================================

// 1. Get available datasets
app.get('/api/datasets', (req, res) => {
  try {
    const datasets = getAllDatasets();
    res.json({ success: true, datasets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get samples in a dataset
app.get('/api/samples', (req, res) => {
  try {
    const dataset = req.query.dataset || 'chartqa';
    const samples = getDatasetSamples(dataset);
    res.json({ success: true, count: samples.length, dataset, samples });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get single sample by ID
app.get('/api/sample/:id', (req, res) => {
  try {
    const dataset = req.query.dataset || 'chartqa';
    const sample = getSampleById(req.params.id, dataset);
    res.json({ success: true, sample });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

// 4. Run Full 8-Stage Research Pipeline (supports /api/pipeline/run and /api/query)
const handlePipelineQuery = async (req, res) => {
  try {
    const { question, dataset = 'chartqa', provider = 'gemini', uploadedImage, userContext } = req.body;
    const selectedSampleId = req.body.selectedSampleId || req.body.sampleId;

    if (!question && !selectedSampleId && !uploadedImage) {
      return res.status(400).json({ success: false, error: "Either 'question' text, 'uploadedImage', or 'selectedSampleId'/'sampleId' is required." });
    }

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

    const timelineTrace = [];

    // BRANCH: User Uploaded Image Flow
    if (uploadedImage) {
      let validated;
      try {
        validated = validateUploadedImage(uploadedImage);
      } catch (valErr) {
        return res.status(400).json({ success: false, error: valErr.message });
      }

      const { mediaType, cleanBase64 } = validated;

      // Stage 1: Question Input
      const stage1 = {
        stage: 1,
        name: "Question",
        inputMode: "user_upload",
        question: question || "What is shown in this image?",
        selectedSampleId: null,
        dataset: null,
        userContext: userContext || null
      };
      timelineTrace.push(stage1);

      // Stage 2: Retrieval (Skipped for user upload)
      const stage2 = {
        stage: 2,
        name: "Retrieval",
        mode: "user_upload",
        sampleType: "user_upload",
        topMatches: []
      };
      timelineTrace.push(stage2);

      // Stage 3: Evidence Construction (Vision Call or Document Parser)
      let extractedEvidence = '';
      const isDoc = isDocumentType(mediaType, uploadedImage.name);
      try {
        if (isDoc) {
          extractedEvidence = await extractDocumentText(Buffer.from(cleanBase64, 'base64'), mediaType, uploadedImage.name);
          if (!extractedEvidence && mediaType === 'application/pdf') {
            extractedEvidence = await extractEvidenceFromImage(provider, mediaType, cleanBase64);
          }
        } else {
          extractedEvidence = await extractEvidenceFromImage(provider, mediaType, cleanBase64);
        }
      } catch (extErr) {
        return res.status(400).json({ success: false, error: extErr.message });
      }

      const docLabel = mediaType === 'application/pdf' ? 'PDF DOCUMENT' : (isDoc ? 'WORD DOCUMENT' : 'IMAGE');
      const formattedEvidence = `[EXTRACTED EVIDENCE FROM ${docLabel}]\n${extractedEvidence}${userContext ? `\n\n[USER CONTEXT]\n${userContext}` : ''}`;

      const constructedEvidenceBlock = {
        sample: null,
        sampleType: "user_upload",
        extractedEvidence,
        userContext: userContext || "",
        formattedEvidence,
        markdownTable: "_No data table (user upload)_",
        base64Image: cleanBase64,
        mediaType,
        score: 1.0,
        contextPrompt: formattedEvidence
      };

      const stage3 = {
        stage: 3,
        name: "Evidence Construction (user_upload)",
        sampleType: "user_upload",
        evidenceSummary: {
          title: "User Uploaded Image",
          sampleType: "user_upload",
          hasImage: true,
          extractedEvidence,
          userContext: userContext || "",
          formattedEvidence
        },
        constructedPrompt: formattedEvidence
      };
      timelineTrace.push(stage3);

      // Store upload in-memory with generated runId
      cleanupUploadStore();
      const runId = crypto.randomUUID();
      uploadStore.set(runId, {
        runId,
        mediaType,
        cleanBase64,
        extractedEvidence,
        userContext: userContext || "",
        createdAt: Date.now()
      });

      // Stage 4: Generation via chosen LLM Provider
      const genResult = await generateAnswer(provider, constructedEvidenceBlock, stage1.question);
      const stage4 = {
        stage: 4,
        name: "Generation",
        sampleType: "user_upload",
        provider: genResult.provider,
        answer: genResult.answer,
        latencyMs: genResult.latencyMs,
        mode: genResult.mode
      };
      timelineTrace.push(stage4);

      // Stage 5: Hallucination Detection
      const detectionResult = await detectHallucinations(genResult.answer, constructedEvidenceBlock, provider);
      const stage5 = {
        stage: 5,
        name: "Hallucination Detection (user_upload)",
        sampleType: "user_upload",
        numericCheck: detectionResult.numericCheck,
        choiceCheck: detectionResult.choiceCheck,
        claimCheck: detectionResult.claimCheck,
        status: detectionResult.summary.status
      };
      timelineTrace.push(stage5);

      // Stage 6: Quantification
      const sessionStats = sessionTracker.recordRun({
        provider: genResult.provider,
        detection: detectionResult,
        question: stage1.question,
        sampleId: "user_upload",
        sampleType: "user_upload"
      });

      const stage6 = {
        stage: 6,
        name: "Quantification",
        sampleType: "user_upload",
        responseHallucinationRate: detectionResult.summary.hallucinationRate,
        responseHallucinationPercentage: (detectionResult.summary.hallucinationRate * 100).toFixed(1) + '%',
        sessionStats
      };
      timelineTrace.push(stage6);

      // Stage 7: Mitigation
      const stage7 = {
        stage: 7,
        name: "Mitigation",
        sampleType: "user_upload",
        status: "OPTIONAL_USER_TRIGGERED",
        description: "Click 'Re-check & Fix' to re-run generation under strict evidence constraint and verify hallucination reduction."
      };
      timelineTrace.push(stage7);

      // Stage 8: Final Answer & Evaluation
      const stage8 = {
        stage: 8,
        name: "Final Answer & Evaluation",
        sampleType: "user_upload",
        finalAnswer: genResult.answer,
        goldAnswer: null,
        isGoldMatch: null,
        relaxedAccuracy: "N/A (no ground truth for uploaded images)",
        hallucinationRate: detectionResult.summary.hallucinationRate,
        citationsUsed: [
          { source: "USER_UPLOAD", item: "User Uploaded Image" }
        ]
      };
      timelineTrace.push(stage8);

      // Clean evidence block for response (omit base64 from JSON response body)
      const responseEvidence = {
        ...constructedEvidenceBlock,
        base64Image: undefined
      };

      return res.json({
        success: true,
        runId,
        provider,
        sampleType: "user_upload",
        question: stage1.question,
        evidence: responseEvidence,
        generation: genResult,
        detection: detectionResult,
        sessionStats,
        timelineTrace,
        quota: quotaInfo
      });
    }

    // Standard Dataset Benchmark Sample Flow
    // Stage 1: Question Input
    const stage1 = {
      stage: 1,
      name: "Question",
      inputMode: selectedSampleId ? "manual_sample_pick" : "free_text_query",
      question: question || (selectedSampleId ? getSampleById(selectedSampleId, dataset).question : ""),
      selectedSampleId: selectedSampleId || null,
      dataset
    };
    timelineTrace.push(stage1);

    // Stage 2: Retrieval (TF-IDF Cosine Match against samples.json)
    const retrievalResult = retrieveEvidence(stage1.question, selectedSampleId, dataset, 3);
    const primarySample = retrievalResult.matches[0]?.sample || null;
    const sampleType = getNormalizedSampleType(primarySample);

    const stage2 = {
      stage: 2,
      name: "Retrieval",
      mode: retrievalResult.mode,
      sampleType,
      topMatches: retrievalResult.matches.map(m => ({
        id: m.sample.id,
        title: m.sample.title,
        question: m.sample.question,
        type: getNormalizedSampleType(m.sample),
        similarityScore: m.score,
        matchLabel: m.matchLabel,
        imagePath: m.sample.imagePath
      }))
    };
    timelineTrace.push(stage2);

    // Stage 3: Evidence Construction
    const formattedEvidence = primarySample ? formatEvidenceForPrompt(primarySample) : "_No evidence_";
    const markdownTable = primarySample ? formatTableToMarkdown(primarySample.table) : "_No table_";
    const imagePath = primarySample ? primarySample.imagePath : null;
    const base64Image = imagePath ? getBase64Image(imagePath) : null;

    const constructedEvidenceBlock = {
      sample: primarySample,
      sampleType,
      formattedEvidence,
      markdownTable,
      imagePath,
      score: retrievalResult.matches[0]?.score || 0,
      contextPrompt: `[STRICT EVIDENCE CONTEXT - ${sampleType}]\nTitle: ${primarySample?.title || 'Unknown'}\nEvidence:\n${formattedEvidence}\n\nUser Question: ${stage1.question}`
    };

    const stage3 = {
      stage: 3,
      name: `Evidence Construction (${sampleType})`,
      sampleType,
      evidenceSummary: {
        title: primarySample?.title || "Custom Question",
        sampleType,
        hasImage: !!base64Image,
        imagePath,
        formattedEvidence,
        tableRowsCount: primarySample?.table?.length || 0,
        markdownTable
      },
      constructedPrompt: constructedEvidenceBlock.contextPrompt
    };
    timelineTrace.push(stage3);

    // Stage 4: Generation via chosen LLM Provider
    const genResult = await generateAnswer(provider, constructedEvidenceBlock, stage1.question);
    const stage4 = {
      stage: 4,
      name: "Generation",
      sampleType,
      provider: genResult.provider,
      answer: genResult.answer,
      latencyMs: genResult.latencyMs,
      mode: genResult.mode
    };
    timelineTrace.push(stage4);

    // Stage 5: Hallucination Detection (Numeric check / Choice check + RAGTruth taxonomy)
    const detectionResult = await detectHallucinations(genResult.answer, constructedEvidenceBlock, provider);
    const stage5 = {
      stage: 5,
      name: `Hallucination Detection (${sampleType})`,
      sampleType,
      numericCheck: detectionResult.numericCheck,
      choiceCheck: detectionResult.choiceCheck,
      claimCheck: detectionResult.claimCheck,
      status: detectionResult.summary.status
    };
    timelineTrace.push(stage5);

    // Stage 6: Quantification
    const sessionStats = sessionTracker.recordRun({
      provider: genResult.provider,
      detection: detectionResult,
      question: stage1.question,
      sampleId: primarySample?.id,
      sampleType
    });

    const stage6 = {
      stage: 6,
      name: "Quantification",
      sampleType,
      responseHallucinationRate: detectionResult.summary.hallucinationRate,
      responseHallucinationPercentage: (detectionResult.summary.hallucinationRate * 100).toFixed(1) + '%',
      sessionStats
    };
    timelineTrace.push(stage6);

    // Stage 7: Mitigation (Ready for optional user trigger)
    const stage7 = {
      stage: 7,
      name: "Mitigation",
      sampleType,
      status: "OPTIONAL_USER_TRIGGERED",
      description: "Click 'Re-check & Fix' to re-run generation under strict evidence constraint and verify hallucination reduction."
    };
    timelineTrace.push(stage7);

    // Stage 8: Final Answer & Evaluation
    const goldAnswer = primarySample?.answer || null;
    let goldMatch = null;

    if (goldAnswer) {
      if (sampleType === 'science_mc') {
        const targetChoice = (primarySample.choices && primarySample.answerIndex !== undefined)
          ? primarySample.choices[primarySample.answerIndex]
          : goldAnswer;
        const ansLower = genResult.answer.toLowerCase();
        const targetLower = String(targetChoice).toLowerCase();
        goldMatch = ansLower.includes(targetLower) ||
          (primarySample.answerIndex !== undefined && ansLower.includes(String.fromCharCode(65 + primarySample.answerIndex).toLowerCase() + ')'));
      } else if (sampleType === 'paper_figure') {
        goldMatch = genResult.answer.toLowerCase().includes(goldAnswer.toLowerCase());
      } else {
        const genNums = extractNumbers(genResult.answer);
        const goldNums = extractNumbers(goldAnswer);
        if (genNums.length > 0 && goldNums.length > 0) {
          goldMatch = checkNumericAccuracy(genNums[0].value, goldNums[0].value);
        } else {
          goldMatch = genResult.answer.toLowerCase().includes(goldAnswer.toLowerCase());
        }
      }
    }

    const stage8 = {
      stage: 8,
      name: "Final Answer & Evaluation",
      sampleType,
      finalAnswer: genResult.answer,
      goldAnswer,
      isGoldMatch: goldMatch,
      relaxedAccuracy: goldMatch === true ? (sampleType === 'chart_table' ? "CORRECT (Within 5% tolerance)" : "CORRECT (Matched Ground Truth)") : goldMatch === false ? "MISMATCH" : "N/A",
      hallucinationRate: detectionResult.summary.hallucinationRate,
      citationsUsed: [
        { source: primarySample?.source || dataset.toUpperCase(), item: primarySample?.title || "Evidence Block" }
      ]
    };
    timelineTrace.push(stage8);

    // Complete pipeline response object
    res.json({
      success: true,
      provider,
      sampleType,
      question: stage1.question,
      evidence: constructedEvidenceBlock,
      generation: genResult,
      detection: detectionResult,
      sessionStats,
      timelineTrace,
      quota: quotaInfo
    });

  } catch (err) {
    console.error("Pipeline execution error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

app.post('/api/pipeline/run', handlePipelineQuery);
app.post('/api/query', handlePipelineQuery);


// 5. Trigger Stage 7 Mitigation Pass
app.post('/api/pipeline/mitigate', async (req, res) => {
  try {
    const { pipelineResult, runId } = req.body;
    const targetRunId = runId || pipelineResult?.runId;

    if (pipelineResult?.sampleType === 'user_upload' || targetRunId) {
      if (!targetRunId || !uploadStore.has(targetRunId)) {
        return res.status(404).json({ success: false, error: "Upload session expired or not found. Please re-run the pipeline." });
      }

      const stored = uploadStore.get(targetRunId);
      const reconstructedEvidence = {
        sample: null,
        sampleType: 'user_upload',
        extractedEvidence: stored.extractedEvidence,
        userContext: stored.userContext,
        formattedEvidence: `[EXTRACTED EVIDENCE FROM IMAGE]\n${stored.extractedEvidence}${stored.userContext ? `\n\n[USER CONTEXT]\n${stored.userContext}` : ''}`,
        base64Image: stored.cleanBase64,
        mediaType: stored.mediaType
      };

      const fullPipelineResult = {
        provider: pipelineResult?.provider || (process.env.GEMINI_API_KEY ? 'gemini' : 'claude'),
        evidence: reconstructedEvidence,
        question: pipelineResult?.question || "What is shown in this image?",
        generation: pipelineResult?.generation,
        detection: pipelineResult?.detection
      };

      const mitigationComparison = await runMitigationPass(fullPipelineResult);
      return res.json({ success: true, comparison: mitigationComparison });
    }

    if (!pipelineResult || !pipelineResult.evidence) {
      return res.status(400).json({ success: false, error: "Valid pipelineResult payload is required." });
    }

    const mitigationComparison = await runMitigationPass(pipelineResult);
    res.json({ success: true, comparison: mitigationComparison });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Batch Benchmark Evaluation Endpoint across Datasets
app.post('/api/benchmark/batch-eval', async (req, res) => {
  try {
    const { dataset = 'chartqa', limit = 5, provider = 'gemini' } = req.body;
    const samples = getDatasetSamples(dataset);
    const countToRun = Math.min(Math.max(Number(limit) || 5, 1), Math.min(25, samples.length));
    const selectedSamples = samples.slice(0, countToRun);

    const results = [];
    let totalClaimsEvaluated = 0;
    let totalHallucinatedClaims = 0;
    let numericCorrectCount = 0;
    let numericEvaluatedCount = 0;
    let goldMatchCount = 0;
    let totalLatencyMs = 0;

    for (const sample of selectedSamples) {
      const sampleType = getNormalizedSampleType(sample);
      const formattedEvidence = formatEvidenceForPrompt(sample);
      const markdownTable = formatTableToMarkdown(sample.table);
      const imagePath = sample.imagePath;

      const constructedEvidenceBlock = {
        sample,
        sampleType,
        formattedEvidence,
        markdownTable,
        imagePath,
        score: 1.0,
        contextPrompt: `[STRICT EVIDENCE CONTEXT - ${sampleType}]\nTitle: ${sample.title || 'Unknown'}\nEvidence:\n${formattedEvidence}\n\nUser Question: ${sample.question}`
      };

      // 1. Generation
      const genResult = await generateAnswer(provider, constructedEvidenceBlock, sample.question);
      totalLatencyMs += (genResult.latencyMs || 0);

      // 2. Hallucination Detection
      const detectionResult = await detectHallucinations(genResult.answer, constructedEvidenceBlock, provider);

      // 3. Ground Truth Evaluation
      const goldAnswer = sample.answer;
      let goldMatch = false;
      let relaxedVerdict = "MISMATCH";

      if (goldAnswer) {
        if (sampleType === 'science_mc') {
          const targetChoice = (sample.choices && sample.answerIndex !== undefined) ? sample.choices[sample.answerIndex] : goldAnswer;
          const ansLower = genResult.answer.toLowerCase();
          goldMatch = ansLower.includes(String(targetChoice).toLowerCase()) || (sample.answerIndex !== undefined && ansLower.includes(String.fromCharCode(65 + sample.answerIndex).toLowerCase() + ')'));
          relaxedVerdict = goldMatch ? "CORRECT (Option Match)" : "MISMATCH";
        } else if (sampleType === 'paper_figure') {
          goldMatch = genResult.answer.toLowerCase().includes(goldAnswer.toLowerCase());
          relaxedVerdict = goldMatch ? "CORRECT (Caption Grounded)" : "MISMATCH";
        } else {
          const genNums = extractNumbers(genResult.answer);
          const goldNums = extractNumbers(goldAnswer);
          if (genNums.length > 0 && goldNums.length > 0) {
            numericEvaluatedCount++;
            const numMatch = checkNumericAccuracy(genNums[0].value, goldNums[0].value);
            if (numMatch) numericCorrectCount++;
            goldMatch = numMatch;
            relaxedVerdict = numMatch ? "CORRECT (Within 5% Tolerance)" : "NUMERIC_ERROR";
          } else {
            goldMatch = genResult.answer.toLowerCase().includes(goldAnswer.toLowerCase());
            relaxedVerdict = goldMatch ? "CORRECT (Semantic Match)" : "MISMATCH";
          }
        }
      }
      if (goldMatch) goldMatchCount++;

      const cCheck = detectionResult.claimCheck || { totalClaims: 0, hallucinatedCount: 0, claims: [] };
      totalClaimsEvaluated += cCheck.totalClaims;
      totalHallucinatedClaims += cCheck.hallucinatedCount;

      results.push({
        id: sample.id,
        title: sample.title,
        question: sample.question,
        sampleType,
        goldAnswer,
        generatedAnswer: genResult.answer,
        goldMatch,
        relaxedVerdict,
        hallucinationRate: detectionResult.summary?.hallucinationRate || 0,
        hallucinatedCount: cCheck.hallucinatedCount,
        totalClaims: cCheck.totalClaims,
        claims: cCheck.claims,
        numericCheck: detectionResult.numericCheck,
        status: detectionResult.summary?.status || 'COMPLETED',
        latencyMs: genResult.latencyMs || 0
      });
    }

    const overallHallucinationRate = totalClaimsEvaluated > 0
      ? Number((totalHallucinatedClaims / totalClaimsEvaluated).toFixed(4))
      : 0;
    const numericAccuracyRate = numericEvaluatedCount > 0
      ? Number((numericCorrectCount / numericEvaluatedCount).toFixed(4))
      : 1.0;
    const goldMatchRate = selectedSamples.length > 0
      ? Number((goldMatchCount / selectedSamples.length).toFixed(4))
      : 0;
    const avgLatencyMs = selectedSamples.length > 0
      ? Math.round(totalLatencyMs / selectedSamples.length)
      : 0;

    res.json({
      success: true,
      dataset,
      count: selectedSamples.length,
      metrics: {
        totalEvaluated: selectedSamples.length,
        totalClaimsEvaluated,
        totalHallucinatedClaims,
        overallHallucinationRate,
        overallHallucinationPercentage: (overallHallucinationRate * 100).toFixed(1) + '%',
        numericAccuracyRate,
        numericAccuracyPercentage: (numericAccuracyRate * 100).toFixed(1) + '%',
        goldMatchRate,
        goldMatchPercentage: (goldMatchRate * 100).toFixed(1) + '%',
        avgLatencyMs
      },
      results
    });
  } catch (err) {
    console.error("Batch eval error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get Running Session Statistics
app.get('/api/session/stats', (req, res) => {
  res.json({ success: true, stats: sessionTracker.getStats() });
});

// 7. Reset Running Session Statistics
app.post('/api/session/reset', (req, res) => {
  sessionTracker.reset();
  res.json({ success: true, stats: sessionTracker.getStats() });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`Multimodal AI Image Chat running at http://localhost:${PORT}`);
  console.log(`Chat Interface: http://localhost:${PORT}/`);
  console.log(`==================================================\n`);
});
