import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

const WIDTH = 2400;
const HEIGHT = 1400;

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe ? String(unsafe) : '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" style="background-color: #07090e; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bgGlow1" cx="20%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#1e1b4b" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#07090e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bgGlow2" cx="80%" cy="80%" r="50%">
      <stop offset="0%" stop-color="#064e3b" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#07090e" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="stage5Glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="stage7Glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>

    <!-- Linear Gradients for Cards -->
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="50%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <linearGradient id="cardGradDark" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#141c2e"/>
      <stop offset="100%" stop-color="#0e1320"/>
    </linearGradient>
    <linearGradient id="cardGradHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a233a"/>
      <stop offset="100%" stop-color="#111728"/>
    </linearGradient>

    <!-- Markers for Arrows -->
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#6366f1"/>
    </marker>
    <marker id="arrowEmerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981"/>
    </marker>
    <marker id="arrowCyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#06b6d4"/>
    </marker>

    <!-- Filters -->
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    <filter id="glowShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#6366f1" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Background Grids & Ambient Glows -->
  <rect width="100%" height="100%" fill="#07090e"/>
  <rect width="100%" height="100%" fill="url(#bgGlow1)"/>
  <rect width="100%" height="100%" fill="url(#bgGlow2)"/>

  <!-- Subtle Blueprint Grid Pattern -->
  <g opacity="0.07" stroke="#ffffff" stroke-width="1">
    ${Array.from({ length: 40 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="${HEIGHT}" />`).join('\n')}
    ${Array.from({ length: 25 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="${WIDTH}" y2="${i * 60}" />`).join('\n')}
  </g>

  <!-- ========================================================================= -->
  <!-- TOP BANNER / TITLE SECTION -->
  <!-- ========================================================================= -->
  <g transform="translate(80, 50)">
    <!-- Logo Badge -->
    <rect x="0" y="0" width="56" height="56" rx="14" fill="#6366f1" opacity="0.2"/>
    <rect x="0" y="0" width="56" height="56" rx="14" stroke="#6366f1" stroke-width="2" fill="none"/>
    <path d="M 28 12 L 44 20 L 44 36 L 28 44 L 12 36 L 12 20 Z" fill="none" stroke="#818cf8" stroke-width="2.5"/>
    <circle cx="28" cy="28" r="4" fill="#06b6d4"/>

    <!-- Title Texts -->
    <text x="76" y="32" font-size="34" font-weight="800" fill="#ffffff" letter-spacing="-0.5px">EvidentAI <tspan fill="#818cf8">—</tspan> Multimodal RAG System Architecture</text>
    <text x="76" y="54" font-size="16" font-weight="500" fill="#94a3b8">Quantifying and Mitigating Hallucinations in Multimodal Retrieval-Augmented Generation · End-to-End Technical Pipeline</text>

    <!-- Version / Status Badges on Right -->
    <g transform="translate(1820, 10)">
      <rect x="0" y="0" width="180" height="36" rx="18" fill="rgba(99, 102, 241, 0.15)" stroke="rgba(99, 102, 241, 0.4)" stroke-width="1.5"/>
      <circle cx="18" cy="18" r="4.5" fill="#10b981"/>
      <text x="32" y="23" font-size="13" font-weight="700" fill="#818cf8" letter-spacing="0.5px">8-STAGE PIPELINE</text>

      <rect x="195" y="0" width="225" height="36" rx="18" fill="rgba(6, 182, 212, 0.15)" stroke="rgba(6, 182, 212, 0.4)" stroke-width="1.5"/>
      <circle cx="213" cy="18" r="4.5" fill="#06b6d4"/>
      <text x="227" y="23" font-size="13" font-weight="700" fill="#22d3ee" letter-spacing="0.5px">STRICT VERIFICATION</text>
    </g>
  </g>


  <!-- ========================================================================= -->
  <!-- LAYER 1: CLIENT PRESENTATION & GATEWAY (Top Horizontal Tier) -->
  <!-- ========================================================================= -->
  <g transform="translate(80, 140)">
    <!-- Container Box -->
    <rect x="0" y="0" width="2240" height="150" rx="16" fill="url(#cardGradDark)" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" filter="url(#cardShadow)"/>
    
    <!-- Left Section Header Tag -->
    <path d="M 0 16 Q 0 0 16 0 L 220 0 L 200 150 L 0 150 Z" fill="rgba(99, 102, 241, 0.08)"/>
    <text x="30" y="45" font-size="12" font-weight="800" fill="#818cf8" letter-spacing="1.5px">LAYER 01 &amp; 02</text>
    <text x="30" y="75" font-size="20" font-weight="700" fill="#ffffff">Client &amp; API</text>
    <text x="30" y="100" font-size="20" font-weight="700" fill="#ffffff">Gateway</text>
    <text x="30" y="125" font-size="12" fill="#64748b">Port 8080 · Express</text>

    <!-- Sub-Block 1: Multimodal UI -->
    <g transform="translate(230, 20)">
      <rect x="0" y="0" width="370" height="110" rx="12" fill="#121826" stroke="rgba(99, 102, 241, 0.25)" stroke-width="1"/>
      <text x="20" y="32" font-size="15" font-weight="700" fill="#ffffff">Interactive Chat UI</text>
      <text x="20" y="52" font-size="12" font-weight="600" fill="#818cf8">chat.html · chat.js</text>
      <text x="20" y="74" font-size="12" fill="#94a3b8">• Obsidian Dark &amp; Light themes</text>
      <text x="20" y="94" font-size="12" fill="#94a3b8">• Continuous multi-turn dialogue</text>
    </g>

    <!-- Sub-Block 2: Document & Visual Ingestion -->
    <g transform="translate(620, 20)">
      <rect x="0" y="0" width="370" height="110" rx="12" fill="#121826" stroke="rgba(6, 182, 212, 0.25)" stroke-width="1"/>
      <text x="20" y="32" font-size="15" font-weight="700" fill="#ffffff">Multimodal Ingestion</text>
      <text x="20" y="52" font-size="12" font-weight="600" fill="#22d3ee">server/documentParser.js</text>
      <text x="20" y="74" font-size="12" fill="#94a3b8">• PNG, JPEG, WebP, GIF, Charts</text>
      <text x="20" y="94" font-size="12" fill="#94a3b8">• PDF (pdf-parse) &amp; DOCX (mammoth)</text>
    </g>

    <!-- Sub-Block 3: Voice & Speech Engine -->
    <g transform="translate(1010, 20)">
      <rect x="0" y="0" width="370" height="110" rx="12" fill="#121826" stroke="rgba(16, 185, 129, 0.25)" stroke-width="1"/>
      <text x="20" y="32" font-size="15" font-weight="700" fill="#ffffff">Voice &amp; Audio Processing</text>
      <text x="20" y="52" font-size="12" font-weight="600" fill="#34d399">Web Speech API</text>
      <text x="20" y="74" font-size="12" fill="#94a3b8">• Real-time dictation with audio waves</text>
      <text x="20" y="94" font-size="12" fill="#94a3b8">• SpeechSynthesis text-to-speech</text>
    </g>

    <!-- Sub-Block 4: Verification Toggle & Modal -->
    <g transform="translate(1400, 20)">
      <rect x="0" y="0" width="370" height="110" rx="12" fill="#121826" stroke="rgba(245, 158, 11, 0.25)" stroke-width="1"/>
      <text x="20" y="32" font-size="15" font-weight="700" fill="#ffffff">Strict Verification Controls</text>
      <text x="20" y="52" font-size="12" font-weight="600" fill="#fbbf24">One-Click Claim Inspector</text>
      <text x="20" y="74" font-size="12" fill="#94a3b8">• Evidence boundary prompt lock</text>
      <text x="20" y="94" font-size="12" fill="#94a3b8">• Color-coded claim audit inspector</text>
    </g>

    <!-- Sub-Block 5: Gateway Routing & Cache -->
    <g transform="translate(1790, 20)">
      <rect x="0" y="0" width="425" height="110" rx="12" fill="#121826" stroke="rgba(99, 102, 241, 0.35)" stroke-width="1.5"/>
      <text x="20" y="32" font-size="15" font-weight="700" fill="#ffffff">Express Router &amp; Store</text>
      <text x="20" y="52" font-size="12" font-weight="600" fill="#818cf8">server.js · /api/pipeline/*</text>
      <text x="20" y="74" font-size="12" fill="#94a3b8">• Magic bytes file security validation</text>
      <text x="20" y="94" font-size="12" fill="#94a3b8">• 10-min in-memory TTL upload cache</text>
    </g>
  </g>

  <!-- Downward Flow Indicators from Gateway to 8-Stage Pipeline -->
  <g stroke="#6366f1" stroke-width="2.5" fill="none" opacity="0.8">
    <path d="M 1200 290 L 1200 340" marker-end="url(#arrow)"/>
  </g>


  <!-- ========================================================================= -->
  <!-- LAYER 2: 8-STAGE RESEARCH & VERIFICATION PIPELINE (Middle Core Section) -->
  <!-- ========================================================================= -->
  <g transform="translate(80, 350)">
    <!-- Main Outer Container -->
    <rect x="0" y="0" width="2240" height="480" rx="18" fill="url(#cardGradDark)" stroke="rgba(99, 102, 241, 0.28)" stroke-width="1.5" filter="url(#cardShadow)"/>

    <!-- Section Header Title Strip -->
    <g transform="translate(40, 35)">
      <rect x="0" y="-8" width="12" height="32" rx="3" fill="#6366f1"/>
      <text x="24" y="16" font-size="22" font-weight="800" fill="#ffffff" letter-spacing="-0.3px">CORE METHODOLOGY: THE 8-STAGE MULTIMODAL RAG PIPELINE</text>
      <text x="730" y="16" font-size="14" font-weight="500" fill="#94a3b8">Sequential execution flow isolating retrieval, generation, audit, and self-correction</text>
    </g>

    <!-- 8 STAGES GRID: Row 1 (Stages 1 - 4), Row 2 (Stages 5 - 8) -->
    
    <!-- ================= STAGE 01 ================= -->
    <g transform="translate(40, 80)">
      <rect x="0" y="0" width="510" height="150" rx="14" fill="#131929" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(99, 102, 241, 0.12)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#818cf8" letter-spacing="1px">STAGE 01</text>
      <text x="90" y="23" font-size="12" font-weight="600" fill="#94a3b8">Input Intent</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">Question Formulation</text>
      <text x="20" y="88" font-size="12.5" fill="#94a3b8">Parses user query intent, distinguishes multimodal</text>
      <text x="20" y="108" font-size="12.5" fill="#94a3b8">goals, and decomposes queries into targeted search tasks.</text>
      <text x="20" y="132" font-size="11.5" font-family="monospace" fill="#818cf8">server.js · handlePipelineQuery()</text>
    </g>

    <!-- Arrow 1 -> 2 -->
    <path d="M 550 155 L 585 155" stroke="#6366f1" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>

    <!-- ================= STAGE 02 ================= -->
    <g transform="translate(590, 80)">
      <rect x="0" y="0" width="510" height="150" rx="14" fill="#131929" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(6, 182, 212, 0.12)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#22d3ee" letter-spacing="1px">STAGE 02</text>
      <text x="90" y="23" font-size="12" font-weight="600" fill="#94a3b8">Lexical / Sparse Match</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">Multimodal Retrieval</text>
      <text x="20" y="88" font-size="12.5" fill="#94a3b8">TF-IDF unigram &amp; bigram cosine search across 320K+</text>
      <text x="20" y="108" font-size="12.5" fill="#94a3b8">corpus items (or bypasses for uploaded images/PDFs).</text>
      <text x="20" y="132" font-size="11.5" font-family="monospace" fill="#06b6d4">server/retrieval.js · retrieveEvidence()</text>
    </g>

    <!-- Arrow 2 -> 3 -->
    <path d="M 1100 155 L 1135 155" stroke="#6366f1" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>

    <!-- ================= STAGE 03 ================= -->
    <g transform="translate(1140, 80)">
      <rect x="0" y="0" width="510" height="150" rx="14" fill="#131929" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(99, 102, 241, 0.12)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#818cf8" letter-spacing="1px">STAGE 03</text>
      <text x="90" y="23" font-size="12" font-weight="600" fill="#94a3b8">Context Assembler</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">Evidence Construction</text>
      <text x="20" y="88" font-size="12.5" fill="#94a3b8">Formats tables to structured Markdown, converts charts</text>
      <text x="20" y="108" font-size="12.5" fill="#94a3b8">to base64 inline buffers, and structures context prompts.</text>
      <text x="20" y="132" font-size="11.5" font-family="monospace" fill="#818cf8">server/dataLoader.js · formatEvidence()</text>
    </g>

    <!-- Arrow 3 -> 4 -->
    <path d="M 1650 155 L 1685 155" stroke="#6366f1" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>

    <!-- ================= STAGE 04 ================= -->
    <g transform="translate(1690, 80)">
      <rect x="0" y="0" width="510" height="150" rx="14" fill="#171f33" stroke="rgba(99, 102, 241, 0.45)" stroke-width="1.5"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(99, 102, 241, 0.25)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#c7d2fe" letter-spacing="1px">STAGE 04</text>
      <text x="90" y="23" font-size="12" font-weight="600" fill="#818cf8">Primary Generation</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">MLLM Generation</text>
      <text x="20" y="88" font-size="12.5" fill="#94a3b8">Gemini 3.1 Flash / Claude / GPT generates structured</text>
      <text x="20" y="108" font-size="12.5" fill="#94a3b8">intermediate rationale and initial candidate answer.</text>
      <text x="20" y="132" font-size="11.5" font-family="monospace" fill="#a5b4fc">server/llm/provider.js · generateAnswer()</text>
    </g>

    <!-- Downward & Leftward Turn from Stage 4 to Stage 5 -->
    <path d="M 1945 230 L 1945 260 L 295 260 L 295 285" stroke="#6366f1" stroke-width="2.5" stroke-dasharray="6,4" fill="none" marker-end="url(#arrow)"/>

    <!-- ================= STAGE 05 (CRITICAL DETECTION ENGINE) ================= -->
    <g transform="translate(40, 290)">
      <!-- Glow Underlay -->
      <rect x="0" y="0" width="510" height="160" rx="14" fill="url(#stage5Glow)"/>
      <rect x="0" y="0" width="510" height="160" rx="14" fill="#1a1424" stroke="rgba(239, 68, 68, 0.55)" stroke-width="1.8"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(239, 68, 68, 0.2)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#f87171" letter-spacing="1px">STAGE 05 · CORE ENGINE</text>
      <text x="195" y="23" font-size="12" font-weight="600" fill="#fca5a5">Claim Audit &amp; ±5% Numeric</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">Hallucination Detection</text>
      <text x="20" y="88" font-size="12.5" fill="#e2e8f0">• Decomposes response into atomic propositions.</text>
      <text x="20" y="108" font-size="12.5" fill="#e2e8f0">• Audits claims into 4-tier grounding taxonomy.</text>
      <text x="20" y="128" font-size="12.5" fill="#e2e8f0">• Runs ChartQA ±5% relaxed numeric tolerance rule.</text>
      <text x="20" y="148" font-size="11.5" font-family="monospace" fill="#f87171">server/detection.js · detectHallucinations()</text>
    </g>

    <!-- Arrow 5 -> 6 -->
    <path d="M 550 370 L 585 370" stroke="#ef4444" stroke-width="2.5" fill="none" marker-end="url(#arrow)"/>

    <!-- ================= STAGE 06 ================= -->
    <g transform="translate(590, 290)">
      <rect x="0" y="0" width="510" height="160" rx="14" fill="#131929" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(99, 102, 241, 0.12)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#818cf8" letter-spacing="1px">STAGE 06</text>
      <text x="90" y="23" font-size="12" font-weight="600" fill="#94a3b8">Error Mapping &amp; Rates</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">Quantification</text>
      <text x="20" y="88" font-size="12.5" fill="#94a3b8">Maps discrepancies into the 5-part error taxonomy,</text>
      <text x="20" y="108" font-size="12.5" fill="#94a3b8">computes Hallucination Rate = Unsupported / Total,</text>
      <text x="20" y="128" font-size="12.5" fill="#94a3b8">and updates session running metrics.</text>
      <text x="20" y="148" font-size="11.5" font-family="monospace" fill="#818cf8">server/quantification.js · SessionTracker</text>
    </g>

    <!-- Arrow 6 -> 7 -->
    <path d="M 1100 370 L 1135 370" stroke="#10b981" stroke-width="2.5" fill="none" marker-end="url(#arrowEmerald)"/>

    <!-- ================= STAGE 07 (MITIGATION & SELF-CORRECTION) ================= -->
    <g transform="translate(1140, 290)">
      <!-- Glow Underlay -->
      <rect x="0" y="0" width="510" height="160" rx="14" fill="url(#stage7Glow)"/>
      <rect x="0" y="0" width="510" height="160" rx="14" fill="#122324" stroke="rgba(16, 185, 129, 0.55)" stroke-width="1.8"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(16, 185, 129, 0.2)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#34d399" letter-spacing="1px">STAGE 07 · SELF-CORRECTION</text>
      <text x="210" y="23" font-size="12" font-weight="600" fill="#6ee7b7">Constrained Re-prompt</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">Mitigation Pass</text>
      <text x="20" y="88" font-size="12.5" fill="#e2e8f0">• Strict prompt constraint: "Rely ONLY on observable pixels".</text>
      <text x="20" y="108" font-size="12.5" fill="#e2e8f0">• Re-runs detection to evaluate factual recovery.</text>
      <text x="20" y="128" font-size="12.5" fill="#e2e8f0">• Computes Δ_abs and relative reduction % (~67% drop).</text>
      <text x="20" y="148" font-size="11.5" font-family="monospace" fill="#34d399">server/mitigation.js · runMitigationPass()</text>
    </g>

    <!-- Arrow 7 -> 8 -->
    <path d="M 1650 370 L 1685 370" stroke="#06b6d4" stroke-width="2.5" fill="none" marker-end="url(#arrowCyan)"/>

    <!-- ================= STAGE 08 ================= -->
    <g transform="translate(1690, 290)">
      <rect x="0" y="0" width="510" height="160" rx="14" fill="#12202a" stroke="rgba(6, 182, 212, 0.55)" stroke-width="1.8"/>
      <rect x="0" y="0" width="510" height="34" rx="14" fill="rgba(6, 182, 212, 0.2)"/>
      <text x="20" y="23" font-size="12" font-weight="800" fill="#22d3ee" letter-spacing="1px">STAGE 08</text>
      <text x="90" y="23" font-size="12" font-weight="600" fill="#67e8f9">Verified Output &amp; Evaluation</text>
      
      <text x="20" y="62" font-size="18" font-weight="700" fill="#ffffff">Verified Answer Delivery</text>
      <text x="20" y="88" font-size="12.5" fill="#e2e8f0">Emits final verified answer with interactive claim pills,</text>
      <text x="20" y="108" font-size="12.5" fill="#e2e8f0">ground truth comparison, citation references,</text>
      <text x="20" y="128" font-size="12.5" fill="#e2e8f0">and transparency verification audit report.</text>
      <text x="20" y="148" font-size="11.5" font-family="monospace" fill="#22d3ee">chat.html / index.html Client View</text>
    </g>
  </g>


  <!-- ========================================================================= -->
  <!-- LAYER 3: SUBSYSTEMS & FOUNDATIONS (Bottom 3 Columns) -->
  <!-- ========================================================================= -->
  <g transform="translate(80, 860)">
    
    <!-- ================= COLUMN 1: DETECTION ENGINE & TAXONOMY ================= -->
    <g transform="translate(0, 0)">
      <rect x="0" y="0" width="720" height="490" rx="16" fill="url(#cardGradDark)" stroke="rgba(239, 68, 68, 0.3)" stroke-width="1.2" filter="url(#cardShadow)"/>
      <path d="M 0 16 Q 0 0 16 0 L 720 0 Q 736 0 736 16 L 736 40 L 0 40 Z" fill="rgba(239, 68, 68, 0.1)"/>
      <text x="24" y="26" font-size="14" font-weight="800" fill="#f87171" letter-spacing="1px">DETECTION SUBSYSTEMS &amp; TAXONOMY</text>

      <!-- 4 Grounding Tiers Grid -->
      <g transform="translate(24, 60)">
        <text x="0" y="0" font-size="14" font-weight="700" fill="#ffffff">RAGTruth 4-Tier Factual Grounding Spectrum</text>

        <!-- Tier 1 -->
        <g transform="translate(0, 15)">
          <rect x="0" y="0" width="325" height="46" rx="8" fill="#132a24" stroke="#10b981" stroke-width="1"/>
          <text x="14" y="22" font-size="13" font-weight="700" fill="#34d399">🟢 Supported</text>
          <text x="14" y="38" font-size="11" fill="#a7f3d0">Directly backed by observable pixels &amp; data.</text>
        </g>
        <!-- Tier 2 -->
        <g transform="translate(345, 15)">
          <rect x="0" y="0" width="325" height="46" rx="8" fill="#2a2414" stroke="#f59e0b" stroke-width="1"/>
          <text x="14" y="22" font-size="13" font-weight="700" fill="#fbbf24">🟡 Subtle Conflict</text>
          <text x="14" y="38" font-size="11" fill="#fde68a">Minor rounding, units, or slight misalignment.</text>
        </g>
        <!-- Tier 3 -->
        <g transform="translate(0, 70)">
          <rect x="0" y="0" width="325" height="46" rx="8" fill="#2d1519" stroke="#ef4444" stroke-width="1"/>
          <text x="14" y="22" font-size="13" font-weight="700" fill="#f87171">🔴 Evident Conflict</text>
          <text x="14" y="38" font-size="11" fill="#fecaca">Directly contradicts values or visual bars.</text>
        </g>
        <!-- Tier 4 -->
        <g transform="translate(345, 70)">
          <rect x="0" y="0" width="325" height="46" rx="8" fill="#261730" stroke="#a855f7" stroke-width="1"/>
          <text x="14" y="22" font-size="13" font-weight="700" fill="#c084fc">🟣 Baseless Extrapolation</text>
          <text x="14" y="38" font-size="11" fill="#e9d5ff">Asserts claims nowhere in source evidence.</text>
        </g>
      </g>

      <!-- 5-Part Error Taxonomy -->
      <g transform="translate(24, 205)">
        <text x="0" y="0" font-size="14" font-weight="700" fill="#ffffff">5-Part Error Taxonomy (Procedural vs Hallucination)</text>
        
        <g transform="translate(0, 12)">
          <rect x="0" y="0" width="670" height="25" rx="6" fill="#151c2e"/>
          <text x="10" y="17" font-size="11.5" font-weight="700" fill="#818cf8">01. Retrieval Error</text>
          <text x="175" y="17" font-size="11.5" fill="#94a3b8">Procedural · Missing relevant snippet in dense/sparse context.</text>
        </g>
        <g transform="translate(0, 42)">
          <rect x="0" y="0" width="670" height="25" rx="6" fill="#151c2e"/>
          <text x="10" y="17" font-size="11.5" font-weight="700" fill="#818cf8">02. Reasoning Error</text>
          <text x="175" y="17" font-size="11.5" fill="#94a3b8">Procedural · Correct numbers extracted, but bad math/logic.</text>
        </g>
        <g transform="translate(0, 72)">
          <rect x="0" y="0" width="670" height="25" rx="6" fill="#151c2e"/>
          <text x="10" y="17" font-size="11.5" font-weight="700" fill="#818cf8">03. Generation Error</text>
          <text x="175" y="17" font-size="11.5" fill="#94a3b8">Procedural · Sound intermediate proof, wrong final token.</text>
        </g>
        <g transform="translate(0, 102)">
          <rect x="0" y="0" width="670" height="25" rx="6" fill="#151c2e"/>
          <text x="10" y="17" font-size="11.5" font-weight="700" fill="#818cf8">04. Grounding Error</text>
          <text x="175" y="17" font-size="11.5" fill="#94a3b8">Visual Procedural · Inverted axes, low contrast, column slip.</text>
        </g>
        <g transform="translate(0, 132)">
          <rect x="0" y="0" width="670" height="28" rx="6" fill="#2d1519" stroke="#ef4444" stroke-width="1"/>
          <text x="10" y="19" font-size="11.5" font-weight="700" fill="#f87171">05. Hallucination Error</text>
          <text x="175" y="19" font-size="11.5" fill="#fecaca">Categorical · Fact invented/contradicting evidence context.</text>
        </g>
      </g>

      <!-- Numeric Formula Callout -->
      <g transform="translate(24, 400)">
        <rect x="0" y="0" width="670" height="65" rx="8" fill="#111624" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1"/>
        <text x="16" y="24" font-size="12" font-weight="700" fill="#10b981">ChartQA Relaxed Numeric Accuracy Rule (±5% Tolerance Window)</text>
        <text x="16" y="48" font-size="12.5" font-family="monospace" fill="#ffffff">RelativeError = |givenValue - targetValue| / |targetValue| &lt;= 0.05</text>
        <text x="500" y="48" font-size="11" fill="#64748b">(Years 1900-2099 &amp; Q1-Q4 excluded)</text>
      </g>
    </g>


    <!-- ================= COLUMN 2: MULTIMODAL PROVIDERS & JUDGES ================= -->
    <g transform="translate(760, 0)">
      <rect x="0" y="0" width="720" height="490" rx="16" fill="url(#cardGradDark)" stroke="rgba(99, 102, 241, 0.3)" stroke-width="1.2" filter="url(#cardShadow)"/>
      <path d="M 0 16 Q 0 0 16 0 L 720 0 Q 736 0 736 16 L 736 40 L 0 40 Z" fill="rgba(99, 102, 241, 0.1)"/>
      <text x="24" y="26" font-size="14" font-weight="800" fill="#818cf8" letter-spacing="1px">MULTIMODAL MODEL PROVIDERS &amp; LLM-JUDGE</text>

      <!-- Google Gemini Box -->
      <g transform="translate(24, 60)">
        <rect x="0" y="0" width="670" height="115" rx="12" fill="#141a2e" stroke="rgba(99, 102, 241, 0.4)" stroke-width="1.2"/>
        <rect x="18" y="16" width="36" height="36" rx="8" fill="#6366f1" opacity="0.2"/>
        <text x="68" y="34" font-size="16" font-weight="700" fill="#ffffff">Google Gemini API (Default Engine)</text>
        <text x="68" y="52" font-size="12" font-weight="600" fill="#818cf8">gemini-3.1-flash-lite · gemini-1.5-pro · gemini-1.5-flash</text>
        <text x="20" y="80" font-size="12" fill="#94a3b8">• Native high-resolution vision token processing with base64 streaming.</text>
        <text x="20" y="100" font-size="12" fill="#94a3b8">• Low-latency generation &amp; automated fallback for claim auditing.</text>
      </g>

      <!-- Anthropic Claude Box -->
      <g transform="translate(24, 195)">
        <rect x="0" y="0" width="670" height="115" rx="12" fill="#171626" stroke="rgba(245, 158, 11, 0.35)" stroke-width="1"/>
        <rect x="18" y="16" width="36" height="36" rx="8" fill="#f59e0b" opacity="0.2"/>
        <text x="68" y="34" font-size="16" font-weight="700" fill="#ffffff">Anthropic Claude SDK</text>
        <text x="68" y="52" font-size="12" font-weight="600" fill="#fbbf24">claude-sonnet-3-5 · claude-3-haiku</text>
        <text x="20" y="80" font-size="12" fill="#94a3b8">• Structured intermediate rationale with strict system prompt grounding.</text>
        <text x="20" y="100" font-size="12" fill="#94a3b8">• High-precision evaluation judge for ScienceQA and academic papers.</text>
      </g>

      <!-- OpenAI Box -->
      <g transform="translate(24, 330)">
        <rect x="0" y="0" width="670" height="135" rx="12" fill="#141f2a" stroke="rgba(6, 182, 212, 0.35)" stroke-width="1"/>
        <rect x="18" y="16" width="36" height="36" rx="8" fill="#06b6d4" opacity="0.2"/>
        <text x="68" y="34" font-size="16" font-weight="700" fill="#ffffff">OpenAI API</text>
        <text x="68" y="52" font-size="12" font-weight="600" fill="#22d3ee">gpt-4o · gpt-4o-mini</text>
        <text x="20" y="80" font-size="12" fill="#94a3b8">• Cross-provider validation &amp; benchmark comparability.</text>
        <text x="20" y="100" font-size="12" fill="#94a3b8">• Unified abstraction provider layer implemented in server/llm/provider.js.</text>
      </g>
    </g>


    <!-- ================= COLUMN 3: DATA & DUAL-PERSISTENCE LAYER ================= -->
    <g transform="translate(1520, 0)">
      <rect x="0" y="0" width="720" height="490" rx="16" fill="url(#cardGradDark)" stroke="rgba(16, 185, 129, 0.3)" stroke-width="1.2" filter="url(#cardShadow)"/>
      <path d="M 0 16 Q 0 0 16 0 L 720 0 Q 736 0 736 16 L 736 40 L 0 40 Z" fill="rgba(16, 185, 129, 0.1)"/>
      <text x="24" y="26" font-size="14" font-weight="800" fill="#34d399" letter-spacing="1px">DUAL-PERSISTENCE &amp; BENCHMARK REPOSITORY</text>

      <!-- MongoDB Atlas Sync Box -->
      <g transform="translate(24, 60)">
        <rect x="0" y="0" width="670" height="115" rx="12" fill="#122320" stroke="rgba(16, 185, 129, 0.45)" stroke-width="1.2"/>
        <text x="20" y="30" font-size="16" font-weight="700" fill="#ffffff">MongoDB Atlas (Cloud Sync)</text>
        <text x="20" y="50" font-size="12" font-weight="600" fill="#34d399">Mongoose Schema · userStore.js</text>
        <text x="20" y="76" font-size="12" fill="#94a3b8">• Stores user authentication, tiered quota tracking, and multi-turn chat sessions.</text>
        <text x="20" y="96" font-size="12" fill="#94a3b8">• Powers shareable session links (/api/chat/share) with forkable branching.</text>
      </g>

      <!-- Local JSON Fallback Box -->
      <g transform="translate(24, 195)">
        <rect x="0" y="0" width="670" height="105" rx="12" fill="#151b29" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1"/>
        <text x="20" y="30" font-size="16" font-weight="700" fill="#ffffff">Local Storage Offline Fallback</text>
        <text x="20" y="50" font-size="12" font-weight="600" fill="#94a3b8">data/users.json · data/shares.json</text>
        <text x="20" y="74" font-size="12" fill="#94a3b8">• Seamless local fallback when MONGODB_URI is unconfigured or offline.</text>
        <text x="20" y="94" font-size="12" fill="#94a3b8">• Tier quotas: Starter (10), Plus (50), Pro (200), Ultra Pro (Unlimited).</text>
      </g>

      <!-- Benchmarks Suite Box -->
      <g transform="translate(24, 320)">
        <rect x="0" y="0" width="670" height="145" rx="12" fill="#131e2d" stroke="rgba(6, 182, 212, 0.35)" stroke-width="1"/>
        <text x="20" y="30" font-size="16" font-weight="700" fill="#ffffff">Empirical Benchmark Corpus (320,000+ Questions)</text>
        
        <g transform="translate(20, 48)">
          <text x="0" y="16" font-size="12.5" font-weight="700" fill="#818cf8">• ChartQA (32.7K):</text>
          <text x="135" y="16" font-size="12" fill="#94a3b8">Financial &amp; academic plots evaluated via ±5% relaxed accuracy.</text>

          <text x="0" y="42" font-size="12.5" font-weight="700" fill="#34d399">• ScienceQA (21K):</text>
          <text x="135" y="42" font-size="12" fill="#94a3b8">Multimodal scientific diagrams evaluated via multiple-choice gold match.</text>

          <text x="0" y="68" font-size="12.5" font-weight="700" fill="#22d3ee">• SPIQA (270K):</text>
          <text x="135" y="68" font-size="12" fill="#94a3b8">Complex academic paper figures &amp; tables evaluated via caption grounding.</text>
        </g>
      </g>
    </g>
  </g>

  <!-- ========================================================================= -->
  <!-- FOOTER BAR -->
  <!-- ========================================================================= -->
  <g transform="translate(80, 1370)">
    <text x="0" y="0" font-size="12" fill="#64748b">EvidentAI Project Architecture Specification · Node.js v22 · Express · Gemini 3.1 · MongoDB Atlas · Published for Capstone Defense</text>
    <text x="2240" y="0" font-size="12" text-anchor="end" fill="#64748b">Generated: November 2026 · Confidential &amp; Proprietary</text>
  </g>
</svg>
`;

async function main() {
  const rootDir = process.cwd(); // capstone real or capstonecopy
  
  const svgPath1 = path.join(rootDir, 'system_architecture.svg');
  const pngPath1 = path.join(rootDir, 'system_architecture.png');
  const svgPath2 = path.join(rootDir, '..', 'system_architecture.svg');
  const pngPath2 = path.join(rootDir, '..', 'system_architecture.png');

  // 1. Write SVG file
  fs.writeFileSync(svgPath1, svgContent, 'utf-8');
  console.log(`Saved SVG to: ${svgPath1}`);

  try {
    fs.writeFileSync(svgPath2, svgContent, 'utf-8');
    console.log(`Saved SVG to: ${svgPath2}`);
  } catch (e) {
    // If running from root already
  }

  // 2. Render to Ultra-High-Resolution PNG using Resvg
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: WIDTH
    },
    font: {
      loadSystemFonts: true
    }
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  fs.writeFileSync(pngPath1, pngBuffer);
  console.log(`Saved High-Res PNG to: ${pngPath1} (${pngBuffer.length} bytes)`);

  try {
    fs.writeFileSync(pngPath2, pngBuffer);
    console.log(`Saved High-Res PNG to: ${pngPath2} (${pngBuffer.length} bytes)`);
  } catch (e) {
    // If running from root already
  }

  console.log('System architecture image generation complete!');
}

main().catch(err => {
  console.error('Error generating architecture diagram:', err);
  process.exit(1);
});

