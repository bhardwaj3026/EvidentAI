import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import mammoth from 'mammoth';

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe ? String(unsafe) : '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI" w:cs="Segoe UI"/>
        <w:sz w:val="22"/>
        <w:color w:val="1F2937"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="276" w:lineRule="auto" w:after="160"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="360" w:after="180"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Segoe UI Semibold" w:hAnsi="Segoe UI Semibold"/>
      <w:b/>
      <w:sz w:val="36"/>
      <w:color w:val="312E81"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="280" w:after="140"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Segoe UI Semibold" w:hAnsi="Segoe UI Semibold"/>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="4338CA"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="200" w:after="100"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Segoe UI Semibold" w:hAnsi="Segoe UI Semibold"/>
      <w:b/>
      <w:sz w:val="24"/>
      <w:color w:val="1E293B"/>
    </w:rPr>
  </w:style>
</w:styles>`;

// Document Builder helper
class DocxBuilder {
  constructor() {
    this.bodyElements = [];
  }

  addTitle(text, subtitle = '') {
    this.bodyElements.push(`
      <w:p>
        <w:pPr>
          <w:jc w:val="center"/>
          <w:spacing w:before="400" w:after="120"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI"/>
            <w:b/>
            <w:sz w:val="48"/>
            <w:color w:val="1E1B4B"/>
          </w:rPr>
          <w:t>${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    `);

    if (subtitle) {
      this.bodyElements.push(`
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:before="0" w:after="360"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Segoe UI" w:hAnsi="Segoe UI"/>
              <w:i/>
              <w:sz w:val="24"/>
              <w:color w:val="6366F1"/>
            </w:rPr>
            <w:t>${escapeXml(subtitle)}</w:t>
          </w:r>
        </w:p>
      `);
    }

    this.addHorizontalDivider();
  }

  addHeading1(text) {
    this.bodyElements.push(`
      <w:p>
        <w:pPr>
          <w:pStyle w:val="Heading1"/>
        </w:pPr>
        <w:r>
          <w:t>${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  addHeading2(text) {
    this.bodyElements.push(`
      <w:p>
        <w:pPr>
          <w:pStyle w:val="Heading2"/>
        </w:pPr>
        <w:r>
          <w:t>${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  addHeading3(text) {
    this.bodyElements.push(`
      <w:p>
        <w:pPr>
          <w:pStyle w:val="Heading3"/>
        </w:pPr>
        <w:r>
          <w:t>${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  addParagraph(text, options = {}) {
    const bold = options.bold ? '<w:b/>' : '';
    const italic = options.italic ? '<w:i/>' : '';
    const color = options.color ? `<w:color w:val="${options.color}"/>` : '';
    const size = options.size ? `<w:sz w:val="${options.size}"/>` : '';

    this.bodyElements.push(`
      <w:p>
        <w:r>
          <w:rPr>
            ${bold}${italic}${color}${size}
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  addImage(rId, widthEmu = 5486400, heightEmu = 3200400, caption = '') {
    this.bodyElements.push(`
      <w:p>
        <w:pPr>
          <w:jc w:val="center"/>
          <w:spacing w:before="240" w:after="120"/>
        </w:pPr>
        <w:r>
          <w:drawing>
            <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
              <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
              <wp:docPr id="1" name="System Architecture Diagram"/>
              <wp:cNvGraphicFramePr>
                <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
              </wp:cNvGraphicFramePr>
              <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                    <pic:nvPicPr>
                      <pic:cNvPr id="0" name="system_architecture.png"/>
                      <pic:cNvPicPr/>
                    </pic:nvPicPr>
                    <pic:blipFill>
                      <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                      <a:stretch><a:fillRect/></a:stretch>
                    </pic:blipFill>
                    <pic:spPr>
                      <a:xfrm>
                        <a:off x="0" y="0"/>
                        <a:ext cx="${widthEmu}" cy="${heightEmu}"/>
                      </a:xfrm>
                      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                    </pic:spPr>
                  </pic:pic>
                </a:graphicData>
              </a:graphic>
            </wp:inline>
          </w:drawing>
        </w:r>
      </w:p>
    `);

    if (caption) {
      this.bodyElements.push(`
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:before="0" w:after="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:i/>
              <w:sz w:val="18"/>
              <w:color w:val="64748B"/>
            </w:rPr>
            <w:t>${escapeXml(caption)}</w:t>
          </w:r>
        </w:p>
      `);
    }
  }

  addBullet(text, boldPrefix = '') {
    this.bodyElements.push(`
      <w:p>
        <w:pPr>
          <w:ind w:left="480" w:hanging="240"/>
          <w:spacing w:after="80"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:color w:val="6366F1"/>
            <w:b/>
          </w:rPr>
          <w:t>•  </w:t>
        </w:r>
        ${boldPrefix ? `
        <w:r>
          <w:rPr>
            <w:b/>
            <w:color w:val="111827"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(boldPrefix)} </w:t>
        </w:r>` : ''}
        <w:r>
          <w:rPr>
            <w:color w:val="374151"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(text)}</w:t>
        </w:r>
      </w:p>
    `);
  }

  addCallout(title, text, color = '4F46E5', bgColor = 'EEF2FF') {
    this.bodyElements.push(`
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="9360" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="none"/>
            <w:left w:val="single" w:sz="24" w:space="0" w:color="${color}"/>
            <w:bottom w:val="none"/>
            <w:right w:val="none"/>
          </w:tblBorders>
          <w:tblCellMar>
            <w:top w:w="140" w:type="dxa"/>
            <w:left w:w="240" w:type="dxa"/>
            <w:bottom w:w="140" w:type="dxa"/>
            <w:right w:w="240" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        <w:tr>
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="9360" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${bgColor}"/>
            </w:tcPr>
            ${title ? `
            <w:p>
              <w:pPr><w:spacing w:after="60"/></w:pPr>
              <w:r>
                <w:rPr><w:b/><w:color w:val="${color}"/><w:sz w:val="22"/></w:rPr>
                <w:t>${escapeXml(title)}</w:t>
              </w:r>
            </w:p>` : ''}
            <w:p>
              <w:pPr><w:spacing w:after="40"/></w:pPr>
              <w:r>
                <w:rPr><w:color w:val="374151"/><w:sz w:val="21"/></w:rPr>
                <w:t xml:space="preserve">${escapeXml(text)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        </w:tr>
      </w:tbl>
      <w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>
    `);
  }

  addTable(headers, rows) {
    const totalWidth = 9360;
    const colWidth = Math.floor(totalWidth / headers.length);

    let headerXml = '<w:tr><w:trPr><w:tblHeader/></w:trPr>';
    for (const h of headers) {
      headerXml += `
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="${colWidth}" w:type="dxa"/>
            <w:shd w:val="clear" w:color="auto" w:fill="312E81"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:spacing w:after="80" w:before="80"/></w:pPr>
            <w:r>
              <w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="21"/></w:rPr>
              <w:t>${escapeXml(h)}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      `;
    }
    headerXml += '</w:tr>';

    let rowsXml = '';
    rows.forEach((row, idx) => {
      const fill = idx % 2 === 0 ? 'F9FAFB' : 'FFFFFF';
      rowsXml += '<w:tr>';
      for (const cell of row) {
        rowsXml += `
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${colWidth}" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:spacing w:after="60" w:before="60"/></w:pPr>
              <w:r>
                <w:rPr><w:color w:val="1F2937"/><w:sz w:val="20"/></w:rPr>
                <w:t>${escapeXml(cell)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        `;
      }
      rowsXml += '</w:tr>';
    });

    this.bodyElements.push(`
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="${totalWidth}" w:type="dxa"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="E5E7EB"/>
            <w:left w:val="none"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
            <w:right w:val="none"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="F3F4F6"/>
            <w:insideV w:val="none"/>
          </w:tblBorders>
          <w:tblCellMar>
            <w:top w:w="100" w:type="dxa"/>
            <w:left w:w="160" w:type="dxa"/>
            <w:bottom w:w="100" w:type="dxa"/>
            <w:right w:w="160" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        ${headerXml}
        ${rowsXml}
      </w:tbl>
      <w:p><w:pPr><w:spacing w:after="200"/></w:pPr></w:p>
    `);
  }

  addHorizontalDivider() {
    this.bodyElements.push(`
      <w:p>
        <w:pPr>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="12" w:space="4" w:color="6366F1"/>
          </w:pBdr>
          <w:spacing w:after="240" w:before="120"/>
        </w:pPr>
      </w:p>
    `);
  }

  buildDocumentXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${this.bodyElements.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  async generateDocx(imageBuffer = null) {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
    zip.file('_rels/.rels', ROOT_RELS_XML);
    zip.file('word/_rels/document.xml.rels', DOC_RELS_XML);
    zip.file('word/styles.xml', STYLES_XML);
    zip.file('word/document.xml', this.buildDocumentXml());

    if (imageBuffer) {
      zip.file('word/media/image1.png', imageBuffer);
    }

    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
  }
}

function safeWrite(filePath, buffer) {
  try {
    fs.writeFileSync(filePath, buffer);
    console.log(`Saved document to: ${filePath}`);
    return true;
  } catch (err) {
    if (err.code === 'EBUSY') {
      const altPath = filePath.replace('.docx', '_v2.docx');
      fs.writeFileSync(altPath, buffer);
      console.log(`Target was locked by Word. Saved to alternative path: ${altPath}`);
      return true;
    }
    throw err;
  }
}

// Main Execution
async function main() {
  const doc = new DocxBuilder();

  // Document Header
  doc.addTitle(
    'EvidentAI — Capstone Technical Reference',
    'Quantifying and Mitigating Hallucinations in Multimodal Retrieval-Augmented Generation'
  );

  doc.addCallout(
    'DOCUMENT METADATA',
    'Conversation Topic: System Architecture & Evaluation Metrics\n' +
    'Platform: EvidentAI Multimodal Grounding Engine\n' +
    'Framework: Node.js, Express, Google Gemini / Claude / GPT-4o, MongoDB Atlas\n' +
    'Generated: November 2026',
    '4F46E5',
    'EEF2FF'
  );

  // SECTION 1: SYSTEM ARCHITECTURE
  doc.addHeading1('1. System Architecture Overview');
  doc.addParagraph(
    'EvidentAI is an end-to-end multimodal verification platform designed for visual question answering, ' +
    'evidence grounding, and on-demand hallucination detection. The system isolates procedural errors ' +
    '(such as poor vector retrieval, optical character misreadings, and arithmetic drift) from true parametric hallucinations.'
  );

  // EMBED SYSTEM ARCHITECTURE DIAGRAM
  const imagePath = path.join(process.cwd(), 'system_architecture.png');
  let imageBuffer = null;
  if (fs.existsSync(imagePath)) {
    imageBuffer = fs.readFileSync(imagePath);
    doc.addImage('rIdImg1', 5486400, 3200400, 'Figure 1: EvidentAI 8-Stage Multimodal RAG System Architecture Diagram');
  }

  doc.addHeading2('1.1 Architectural Layers');
  doc.addBullet('Web application interface providing Obsidian Dark & Clean Light themes, drag-and-drop document/image upload, interactive "Verify Claims" inspector modal, and voice controls (Web Speech API for dictation and SpeechSynthesis TTS).', '1. Client Presentation Layer:');
  doc.addBullet('Express.js REST API service managing HTTP routing, request validation, 10-minute TTL in-memory upload caching, and file magic bytes inspection (blocking spoofed media types).', '2. Server & Routing Gateway:');
  doc.addBullet('Core sequential pipeline that ingests queries, performs multimodal evidence retrieval, constructs structured Markdown tables, generates responses, detects hallucinations, quantifies error rates, applies self-correction mitigation, and formats verified answers.', '3. 8-Stage Research Pipeline:');
  doc.addBullet('Pluggable integration engine supporting Google Gemini (gemini-3.1-flash-lite, gemini-1.5-pro), OpenAI (GPT-4o), and Anthropic Claude (Sonnet 3.5).', '4. Multimodal Model Providers:');
  doc.addBullet('MongoDB Atlas cloud database storing user profiles, chat quotas, and multi-turn conversation sessions, with seamless automated fallback to local JSON storage (data/users.json, data/shares.json).', '5. Dual-Persistence Data Layer:');

  doc.addHeading2('1.2 The 8-Stage Research & Verification Pipeline');
  doc.addTable(
    ['Stage', 'Stage Name', 'Module / Component', 'Key Architectural Function'],
    [
      ['01', 'Question Formulation', 'server.js', 'Decomposes query intent into multimodal retrieval goals.'],
      ['02', 'Multimodal Retrieval', 'server/retrieval.js', 'Runs TF-IDF unigram/bigram cosine similarity search over benchmark samples.'],
      ['03', 'Evidence Construction', 'server/dataLoader.js', 'Converts data tables to Markdown grids, processes base64 images/PDFs.'],
      ['04', 'MLLM Generation', 'server/llm/provider.js', 'Produces structured intermediate rationale and preliminary response.'],
      ['05', 'Hallucination Detection', 'server/detection.js', 'Decomposes answer into atomic claims; audits against 4-tier grounding taxonomy.'],
      ['06', 'Quantification', 'server/quantification.js', 'Calculates Hallucination Rate (HR) and tracks cumulative session metrics.'],
      ['07', 'Mitigation Pass', 'server/mitigation.js', 'Re-prompts under strict evidence constraint ("Rely ONLY on observable pixels").'],
      ['08', 'Verified Answer', 'server.js', 'Delivers final answer with color-coded claim audit badges and citation links.']
    ]
  );

  doc.addHeading2('1.3 Core Detection Subsystems & Error Taxonomy');
  doc.addParagraph(
    'EvidentAI incorporates an explicit 5-part error taxonomy to separate procedural mistakes from true hallucinations:'
  );
  doc.addBullet('The required snippet was omitted from dense/sparse retrieval context.', '1. Retrieval Error (Procedural):');
  doc.addBullet('Evidence was correctly retrieved, but deductions or mathematical calculations were flawed.', '2. Reasoning Error (Procedural):');
  doc.addBullet('Model derived the correct conclusion in its explanation but emitted the wrong final token.', '3. Generation Error (Procedural):');
  doc.addBullet('Vision feature encoding misread axes, labels, low-contrast markings, or inverted grids.', '4. Grounding Error (Visual Procedural):');
  doc.addBullet('Response fabricates entities, values, or trends completely unsupported or contradicting evidence.', '5. Hallucination Error (Categorical):');

  doc.addParagraph('The 4 Grounding Tiers evaluated in Stage 05:');
  doc.addBullet('Directly backed by observable pixels, text, or table rows.', '• Supported (Green):');
  doc.addBullet('Minor rounding, unit, or slight contextual misalignment.', '• Subtle Conflict (Yellow):');
  doc.addBullet('Direct contradiction of explicit values or visual features.', '• Evident Conflict (Red):');
  doc.addBullet('Claims facts or external entities nowhere in the source evidence.', '• Baseless Extrapolation (Purple):');

  doc.addHorizontalDivider();

  // SECTION 2: EVALUATION METRICS
  doc.addHeading1('2. Evaluation Metrics Used in the Project');
  doc.addParagraph(
    'The project employs an empirical framework measuring factual consistency, task accuracy, closed-loop mitigation, and system performance.'
  );

  doc.addHeading2('2.1 Factual Grounding & Hallucination Metrics');
  doc.addCallout(
    'ATOMIC CLAIM HALLUCINATION RATE (HR)',
    'Formula:\n' +
    'Hallucination Rate (HR) = (Total Unsupported Claims) / (Total Claims Evaluated)\n\n' +
    'Grounded Claim Rate = (Total Supported Claims) / (Total Claims Evaluated) = 1 - HR\n\n' +
    'Status:\n' +
    '• FULLY_GROUNDED: HR = 0.0\n' +
    '• HALLUCINATION_DETECTED: HR > 0.0',
    '059669',
    'ECFDF5'
  );

  doc.addHeading2('2.2 Benchmark-Specific Task Accuracy Metrics');
  doc.addTable(
    ['Benchmark', 'Modality', 'Evaluation Metric & Rule', 'Targeted Failure Mode'],
    [
      ['ChartQA', 'Charts & Tables', '5% Relaxed Numeric Accuracy Rule: |given - target| / |target| <= 0.05', 'Axis misreading & arithmetic drift'],
      ['ScienceQA', 'Diagrams & MCQs', 'Multiple-Choice Gold Match Rate: exact choice string or option token (A, B, C, D)', 'Rationale vs. final answer token discrepancy'],
      ['SPIQA', 'Scientific Papers', 'Caption Grounding & Semantic Factuality Check', 'Fabricating experimental methods & citations'],
      ['User Uploads', 'Images & Documents', 'Cross-modal Grounded Factuality & OCR verification', 'Parametric hallucination on novel inputs']
    ]
  );

  doc.addHeading3('ChartQA 5% Relaxed Numeric Accuracy Rule Details');
  doc.addParagraph(
    'To avoid penalizing standard pixel-interpolation variance when reading continuous bar and line charts, ' +
    'the engine evaluates numeric claims within a 5% tolerance window:\n' +
    'Relative Error = |givenValue - targetValue| / |targetValue| <= 0.05\n\n' +
    'Heuristic False-Positive Filter: Calendar years (1900-2099) and financial quarters (Q1-Q4) are automatically excluded from numeric verification.'
  );

  doc.addHeading2('2.3 Stage 07 Mitigation & Self-Correction Delta Metrics');
  doc.addCallout(
    'CLOSED-LOOP MITIGATION DELTA FORMULAS',
    'Absolute Hallucination Reduction:\n' +
    'Δ_abs = HR_original - HR_mitigated\n\n' +
    'Relative Reduction Percentage:\n' +
    'Δ_rel = [(HR_original - HR_mitigated) / HR_original] * 100%\n\n' +
    'Experimental Result:\n' +
    'Enforcing strict evidence boundaries produced a 62.5% to 68.5% relative drop in unsupported claims across evaluated benchmarks.',
    '4338CA',
    'EEF2FF'
  );

  doc.addHeading2('2.4 Retrieval & Operational Metrics');
  doc.addBullet('TF-IDF unigram and bigram cosine similarity between user queries and benchmark sample text (questions, titles, table content).', '• Lexical Cosine Similarity Score:');
  doc.addBullet('Latency measured in milliseconds (latencyMs) per inference turn, with re-grounding mitigation passes averaging < 1.8 seconds.', '• Inference Latency:');
  doc.addBullet('Tracking consumed messages against account limits (Starter: 10, Plus: 50, Pro: 200, Ultra Pro: unlimited).', '• Account Quota Tracking:');

  doc.addHorizontalDivider();

  // SECTION 3: FULL CONVERSATION TRANSCRIPT
  doc.addHeading1('3. Full Conversation Record');

  doc.addHeading2('Turn 1 — User Query');
  doc.addCallout('USER PROMPT', 'give me the system architucture used for this project', '374151', 'F3F4F6');

  doc.addHeading2('Turn 1 — Assistant Response Summary');
  doc.addParagraph(
    'The assistant provided an end-to-end breakdown of the EvidentAI system architecture, detailing the 5 architectural layers:\n' +
    '1. Presentation & Client Layer (chat.html, chat.js, Web Speech API, auth-pages.html)\n' +
    '2. Backend Server & Gateway (server.js, server/chat.js, server/auth.js, server/documentParser.js)\n' +
    '3. 8-Stage Research & Verification Pipeline (Stages 01 through 08)\n' +
    '4. Detection & Auditing Subsystems (Numeric verification, choice verification, claim decomposition, 4-tier grounding)\n' +
    '5. Data & Persistence Engine (MongoDB Atlas cloud sync + local data/users.json fallback)'
  );

  doc.addHeading2('Turn 2 — User Query');
  doc.addCallout('USER PROMPT', 'give the evaluation metrics used for this project', '374151', 'F3F4F6');

  doc.addHeading2('Turn 2 — Assistant Response Summary');
  doc.addParagraph(
    'The assistant detailed all evaluation metrics across four categories:\n' +
    '1. Factual Grounding & Hallucination Metrics: Atomic Claim Hallucination Rate (HR), Grounded Claim Rate, and RAGTruth 4-Tier Grounding Distribution.\n' +
    '2. Task & Benchmark Accuracy Metrics: ChartQA 5% Relaxed Numeric Accuracy, ScienceQA Multiple-Choice Gold Match Rate, and SPIQA Caption Grounding.\n' +
    '3. Stage 07 Mitigation Delta Metrics: Absolute Hallucination Reduction (Δ_abs) and Relative Reduction Percentage (Δ_rel).\n' +
    '4. Retrieval & Operational Metrics: Lexical Cosine Similarity, Latency (ms), and User Tier Quotas.'
  );

  // Generate Document
  const docBuffer = await doc.generateDocx(imageBuffer);

  // Save with fallback
  safeWrite(path.join(process.cwd(), 'EvidentAI_Architecture_and_Metrics.docx'), docBuffer);
  safeWrite(path.join(process.cwd(), '..', 'EvidentAI_Architecture_and_Metrics.docx'), docBuffer);

  // Verify with mammoth
  const extractionResult = await mammoth.extractRawText({ buffer: docBuffer });
  console.log(`Verification succeeded! Extracted text length: ${extractionResult.value.length} characters.`);
}

main().catch(err => {
  console.error("Error generating docx:", err);
  process.exit(1);
});
