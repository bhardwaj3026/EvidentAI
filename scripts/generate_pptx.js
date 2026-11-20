import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

// 16:9 Widescreen dimensions in EMUs (English Metric Units): 13.333 x 7.5 inches
// 1 inch = 914400 EMUs -> 12192000 x 6858000
const SLIDE_WIDTH = 12192000;
const SLIDE_HEIGHT = 6858000;

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
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
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  ${Array.from({ length: 10 }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n  ')}
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

function getPresentationXmlRels(slideCount = 10) {
  let rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>`;
  
  for (let i = 1; i <= slideCount; i++) {
    rels += `\n  <Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>`;
  }
  rels += `\n</Relationships>`;
  return rels;
}

function getPresentationXml(slideCount = 10) {
  let sldIdLst = '';
  for (let i = 1; i <= slideCount; i++) {
    sldIdLst += `<p:sldId id="${255 + i}" r:id="rId${i + 2}"/>`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/officeDocument/2006/presentationml">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
    ${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="${SLIDE_WIDTH}" cy="${SLIDE_HEIGHT}" type="custom"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="EvidentAI Dark Theme">
  <a:themeElements>
    <a:clrScheme name="EvidentAI">
      <a:dk1><a:srgbClr val="0B0F19"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1A2234"/></a:dk2>
      <a:lt2><a:srgbClr val="94A3B8"/></a:lt2>
      <a:accent1><a:srgbClr val="6366F1"/></a:accent1>
      <a:accent2><a:srgbClr val="10B981"/></a:accent2>
      <a:accent3><a:srgbClr val="06B6D4"/></a:accent3>
      <a:accent4><a:srgbClr val="F59E0B"/></a:accent4>
      <a:accent5><a:srgbClr val="EF4444"/></a:accent5>
      <a:accent6><a:srgbClr val="8B5CF6"/></a:accent6>
      <a:hlink><a:srgbClr val="818CF8"/></a:hlink>
      <a:folHlink><a:srgbClr val="C084FC"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Modern Sans">
      <a:majorFont><a:latin typeface="Segoe UI Semibold"/></a:majorFont>
      <a:minorFont><a:latin typeface="Segoe UI"/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

const SLIDE_MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/officeDocument/2006/presentationml">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="07090E"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;

const SLIDE_MASTER_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;

const SLIDE_LAYOUT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/officeDocument/2006/presentationml"
             type="blank" preserve="1">
  <p:cSld name="Blank Layout">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMap/></p:clrMapOvr>
</p:sldLayout>`;

const SLIDE_LAYOUT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

const SLIDE_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

// Helper to create slide shape XML
let shapeIdCounter = 10;
function createShape({ x, y, w, h, fill = null, border = null, textRuns = [], radius = 0 }) {
  const id = shapeIdCounter++;
  const fillXml = fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : '<a:noFill/>';
  const borderXml = border ? `<a:ln w="12700"><a:solidFill><a:srgbClr val="${border}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>';

  let paragraphsXml = '';
  textRuns.forEach(para => {
    let runsXml = '';
    para.runs.forEach(r => {
      const colorVal = r.color || 'FFFFFF';
      const sizeVal = (r.size || 14) * 100;
      const boldAttr = r.bold ? ' b="1"' : '';
      const italicAttr = r.italic ? ' i="1"' : '';
      runsXml += `<a:r>
        <a:rPr lang="en-US" sz="${sizeVal}"${boldAttr}${italicAttr}>
          <a:solidFill><a:srgbClr val="${colorVal}"/></a:solidFill>
          <a:latin typeface="Segoe UI"/>
        </a:rPr>
        <a:t>${escapeXml(r.text)}</a:t>
      </a:r>`;
    });

    const alignAttr = para.align ? ` algn="${para.align}"` : '';
    paragraphsXml += `<a:p>
      <a:pPr${alignAttr}/>
      ${runsXml}
    </a:p>`;
  });

  return `<p:sp>
    <p:nvSpPr>
      <p:cNvPr id="${id}" name="Shape ${id}"/>
      <p:cNvSpPr/>
      <p:nvPr/>
    </p:nvSpPr>
    <p:spPr>
      <a:xfrm>
        <a:off x="${Math.round(x)}" y="${Math.round(y)}"/>
        <a:ext cx="${Math.round(w)}" cy="${Math.round(h)}"/>
      </a:xfrm>
      <a:prstGeom prst="${radius > 0 ? 'roundRect' : 'rect'}">
        <a:avLst/>
      </a:prstGeom>
      ${fillXml}
      ${borderXml}
    </p:spPr>
    <p:txBody>
      <a:bodyPr vert="horz" lIns="144000" tIns="144000" rIns="144000" bIns="144000" anchor="t"/>
      <a:lstStyle/>
      ${paragraphsXml}
    </p:txBody>
  </p:sp>`;
}

// Generate Slide XML from shapes
function buildSlideXml(shapes) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/officeDocument/2006/presentationml">
  <p:cSld>
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="07090E"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${shapes.join('\n')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMap/></p:clrMapOvr>
</p:sld>`;
}

export async function generatePresentation() {
  const zip = new JSZip();

  // Base OpenXML Package files
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', ROOT_RELS_XML);
  zip.file('ppt/presentation.xml', getPresentationXml(10));
  zip.file('ppt/_rels/presentation.xml.rels', getPresentationXmlRels(10));
  zip.file('ppt/theme/theme1.xml', THEME_XML);
  zip.file('ppt/slideMasters/slideMaster1.xml', SLIDE_MASTER_XML);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', SLIDE_MASTER_RELS_XML);
  zip.file('ppt/slideLayouts/slideLayout1.xml', SLIDE_LAYOUT_XML);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', SLIDE_LAYOUT_RELS_XML);

  // Common Header Generator
  function makeSlideHeader(tag, title, subtitle, slideNum) {
    return [
      createShape({
        x: 600000, y: 400000, w: 10992000, h: 400000,
        textRuns: [
          { runs: [{ text: tag.toUpperCase(), size: 11, bold: true, color: '818CF8' }] }
        ]
      }),
      createShape({
        x: 600000, y: 750000, w: 10000000, h: 700000,
        textRuns: [
          { runs: [{ text: title, size: 28, bold: true, color: 'FFFFFF' }] }
        ]
      }),
      createShape({
        x: 600000, y: 1450000, w: 10000000, h: 450000,
        textRuns: [
          { runs: [{ text: subtitle, size: 14, color: '94A3B8' }] }
        ]
      }),
      createShape({
        x: 10500000, y: 400000, w: 1092000, h: 400000,
        textRuns: [
          { align: 'r', runs: [{ text: `${slideNum < 10 ? '0' + slideNum : slideNum} / 10`, size: 12, bold: true, color: '64748B' }] }
        ]
      }),
      createShape({
        x: 600000, y: 6400000, w: 10992000, h: 300000,
        border: '1E293B',
        textRuns: [
          { runs: [{ text: 'EvidentAI · CS-499 Thesis Defense · Verifiable Multimodal AI', size: 9, color: '64748B' }] }
        ]
      })
    ];
  }

  // Slide 1: Title
  const slide1 = [
    createShape({
      x: 600000, y: 800000, w: 10992000, h: 400000,
      textRuns: [{ runs: [{ text: 'FINAL-YEAR CAPSTONE RESEARCH DEFENSE · CS & AI', size: 12, bold: true, color: '818CF8' }] }]
    }),
    createShape({
      x: 600000, y: 1300000, w: 10992000, h: 1200000,
      textRuns: [{ runs: [{ text: 'Quantifying and Mitigating Hallucinations in Multimodal RAG', size: 36, bold: true, color: 'FFFFFF' }] }]
    }),
    createShape({
      x: 600000, y: 2500000, w: 10992000, h: 500000,
      textRuns: [{ runs: [{ text: 'EvidentAI: Explainable & Verifiable Visual Artificial Intelligence for Science and Education', size: 16, color: '94A3B8' }] }]
    }),
    createShape({
      x: 600000, y: 3200000, w: 10992000, h: 900000,
      fill: '101626', border: '6366F1', radius: 1,
      textRuns: [{ runs: [{ text: '"Even when a system retrieves the right evidence, it can still get the answer wrong."', size: 18, bold: true, italic: true, color: 'FFFFFF' }] }]
    }),
    // 3 Highlight Cards
    createShape({
      x: 600000, y: 4400000, w: 3450000, h: 1600000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'THE VISUAL GAP', size: 11, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Why Text RAG Fails', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Textual token metrics cannot detect misread chart axes, inverted plots, or confused table columns.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 4350000, y: 4400000, w: 3450000, h: 1600000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'THE TAXONOMY', size: 11, bold: true, color: '10B981' }] },
        { runs: [{ text: '5-Part Error Taxonomy', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Disentangles procedural reasoning/retrieval failures from categorically distinct hallucinations.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 8100000, y: 4400000, w: 3492000, h: 1600000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'THE PLATFORM', size: 11, bold: true, color: '06B6D4' }] },
        { runs: [{ text: 'EvidentAI Assistant', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '8-stage pipeline, strict verification lock, on-demand claim auditing, and MongoDB Atlas sync.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 600000, y: 6400000, w: 10992000, h: 300000,
      textRuns: [{ runs: [{ text: 'Candidate: Final-Year Candidate · CS-499 Thesis Defense · Evaluated across 320,000+ Questions', size: 10, color: '64748B' }] }]
    })
  ];

  // Slide 2: The Grounding Gap
  const slide2 = [
    ...makeSlideHeader('Problem Statement & Motivation', 'The Multimodal Grounding Gap', 'Why standard text-based RAG evaluation fails in vision-language tasks', 2),
    createShape({
      x: 600000, y: 2100000, w: 5300000, h: 3200000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'TRADITIONAL TEXT RAG', size: 11, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Token & Entailment Faithfulness', size: 18, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Evaluates textual N-gram overlap and semantic entailment against retrieved text passages.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Existing tools: Ragas, SelfCheckGPT, TruLens, RAGTruth.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Fundamental assumption: Evidence contains raw textual answer tokens.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Critical Blind Spot: Cannot evaluate whether a coordinate tick, scatter plot trend, or chart legend was interpreted correctly.', size: 13, bold: true, color: 'F59E0B' }] }
      ]
    }),
    createShape({
      x: 6200000, y: 2100000, w: 5392000, h: 3200000,
      fill: '101626', border: '6366F1', radius: 1,
      textRuns: [
        { runs: [{ text: 'MULTIMODAL RAG (OUR FOCUS)', size: 11, bold: true, color: '06B6D4' }] },
        { runs: [{ text: 'Cross-Modal Evidence Reasoning', size: 18, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Evidence combines dense text, bar charts, scientific diagrams, and paper tables.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Multi-tier inference: Visual perception -> OCR extraction -> Arithmetic deduction.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• High-Stakes Impact: Medicine, finance, and science cannot tolerate visual hallucinations.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• The Core Question: How do we isolate visual reading failures from parametric hallucinations?', size: 13, bold: true, color: '818CF8' }] }
      ]
    }),
    createShape({
      x: 600000, y: 5500000, w: 10992000, h: 700000,
      fill: '1A1F30', border: '6366F1', radius: 1,
      textRuns: [{ runs: [{ text: 'Key Finding: No existing benchmark framework had validated hallucination detection across multimodal systems combining multiple evidence types.', size: 13, bold: true, color: 'FFFFFF' }] }]
    })
  ];

  // Slide 3: 5-Part Error Taxonomy
  const slide3 = [
    ...makeSlideHeader('Theoretical Foundation · Conceptual Core', 'The 5-Part Error Taxonomy', 'Why a wrong answer is not always a hallucination', 3),
    // Left Box: Grounded Errors 1-4
    createShape({
      x: 600000, y: 2100000, w: 6800000, h: 4000000,
      fill: '0E131F', border: '10B981', radius: 1,
      textRuns: [
        { runs: [{ text: 'CATEGORY A · GROUNDED-PROCESS ERRORS (PROCEDURAL)', size: 11, bold: true, color: '10B981' }] },
        { runs: [{ text: '01. Retrieval Error', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Evidence needed was never retrieved from the document store (empty context failure).', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '02. Reasoning Error', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Evidence was retrieved correctly, but logic or arithmetic computation failed (e.g. math discrepancy).', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '03. Generation Error', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Model deduces the right answer in its internal proof, but outputs a contradictory option token.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '04. Grounding Error (Visual Specific)', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Misread visual attributes: inverted Y-axes, low-contrast legend lines, or shifted column alignments.', size: 12, color: '94A3B8' }] }
      ]
    }),
    // Right Box: True Hallucination
    createShape({
      x: 7700000, y: 2100000, w: 3892000, h: 4000000,
      fill: '200B0E', border: 'EF4444', radius: 1,
      textRuns: [
        { runs: [{ text: 'CATEGORY B · CATEGORICALLY DISTINCT', size: 11, bold: true, color: 'EF4444' }] },
        { runs: [{ text: '05. Hallucination Error', size: 18, bold: true, color: 'F87171' }] },
        { runs: [{ text: 'The answer contains assertions unsupported by, or directly contradicting, the retrieved evidence.', size: 13, color: 'CBD5E1' }] },
        { runs: [{ text: '\nSPIQA Research Benchmark Example:\nWhen asked for reaction yield from Table 2, the model claims: "Synthesized under argon gas at 450°C by Smith et al." — when neither argon nor Smith was in the paper.', size: 12, italic: true, color: 'FCA5A5' }] },
        { runs: [{ text: '\nCore Takeaway: Conflating procedural errors with hallucination leads to flawed mitigation strategies.', size: 12, bold: true, color: 'FFFFFF' }] }
      ]
    })
  ];

  // Slide 4: Datasets
  const slide4 = [
    ...makeSlideHeader('Empirical Benchmark Suite · 320K+ Questions', 'Studied Multimodal Datasets', 'Cross-modal evaluation across visual arithmetic, multiple-choice, and full papers', 4),
    createShape({
      x: 600000, y: 2100000, w: 3450000, h: 2800000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'CHARTQA BENCHMARK', size: 11, bold: true, color: '818CF8' }] },
        { runs: [{ text: '32.7K Questions', size: 20, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Open-vocabulary questions over real-world financial, academic, and media charts.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Requires visual perception and multi-step arithmetic.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Evaluated via 5% Relaxed Numeric Accuracy rule.', size: 12, bold: true, color: '818CF8' }] }
      ]
    }),
    createShape({
      x: 4350000, y: 2100000, w: 3450000, h: 2800000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'SCIENCEQA BENCHMARK', size: 11, bold: true, color: '10B981' }] },
        { runs: [{ text: '~21K Questions', size: 20, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Multimodal science and social science questions paired with lecture notes.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Tests rationale faithfulness even when final multiple-choice choice is correct.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Evaluated via choice matching & rationale audits.', size: 12, bold: true, color: '10B981' }] }
      ]
    }),
    createShape({
      x: 8100000, y: 2100000, w: 3492000, h: 2800000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'SPIQA BENCHMARK', size: 11, bold: true, color: '06B6D4' }] },
        { runs: [{ text: '270K Questions', size: 20, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Complex generative QA over embedded scientific figures, diagrams, and paper tables.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Evaluated across In-Distribution and Out-of-Distribution scientific splits.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Audited via RAGTruth 4-class claim verification.', size: 12, bold: true, color: '06B6D4' }] }
      ]
    }),
    // Bottom Stats
    createShape({
      x: 600000, y: 5100000, w: 10992000, h: 1000000,
      fill: '101626', border: '6366F1', radius: 1,
      textRuns: [
        { runs: [{ text: 'TOTAL CORPUS: 320,000+ EVALUATION SAMPLES  |  3 EVIDENCE MODALITIES  |  5% NUMERIC ACCURACY TOLERANCE', size: 13, bold: true, color: 'FFFFFF' }] }
      ]
    })
  ];

  // Slide 5: 8-Stage Pipeline
  const slide5 = [
    ...makeSlideHeader('System Architecture & Methodology', '8-Stage Multimodal RAG Pipeline', 'End-to-end engineered sequence isolating retrieval, generation, and mitigation', 5),
    // 8 Steps Grid
    createShape({
      x: 600000, y: 2100000, w: 2550000, h: 1800000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 01', size: 10, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Question Formulation', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Parse query intent & multimodal goals.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 3400000, y: 2100000, w: 2550000, h: 1800000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 02', size: 10, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Multimodal Retrieval', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Fetch text, charts, and table snippets.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 6200000, y: 2100000, w: 2550000, h: 1800000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 03', size: 10, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Evidence Assembly', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Format Markdown tables & image base64.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 9000000, y: 2100000, w: 2592000, h: 1800000, fill: '1A1F38', border: '6366F1', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 04', size: 10, bold: true, color: '6366F1' }] },
        { runs: [{ text: 'MLLM Generation', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Generate structured rationale & answer.', size: 11, color: '94A3B8' }] }
      ]
    }),

    createShape({
      x: 600000, y: 4100000, w: 2550000, h: 1800000, fill: '250F15', border: 'EF4444', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 05', size: 10, bold: true, color: 'EF4444' }] },
        { runs: [{ text: 'Detection Engine', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Decompose claims & audit grounding.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 3400000, y: 4100000, w: 2550000, h: 1800000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 06', size: 10, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Quantification', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Map to 5-error taxonomy & rate metrics.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 6200000, y: 4100000, w: 2550000, h: 1800000, fill: '0B2319', border: '10B981', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 07', size: 10, bold: true, color: '10B981' }] },
        { runs: [{ text: 'Mitigation Pass', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Strict evidence-locked re-grounding.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 9000000, y: 4100000, w: 2592000, h: 1800000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'STAGE 08', size: 10, bold: true, color: '06B6D4' }] },
        { runs: [{ text: 'Verified Output', size: 14, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Deliver final answer with claim tags.', size: 11, color: '94A3B8' }] }
      ]
    })
  ];

  // Slide 6: Detection Engine
  const slide6 = [
    ...makeSlideHeader('Verification Engine · Stage 05 Deep Dive', 'Automated Hallucination Detection Engine', 'Deconstructing answers into atomic claims and auditing evidence grounding', 6),
    createShape({
      x: 600000, y: 2100000, w: 5300000, h: 2500000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'ATOMIC CLAIM DECOMPOSITION', size: 11, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Fine-Grained Claim Auditing', size: 18, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Answers broken down into individual, testable factual propositions.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Each claim evaluated against extracted OCR table and image context.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Hallucination Rate = (Unsupported Claims) / (Total Claims).', size: 13, bold: true, color: '818CF8' }] }
      ]
    }),
    createShape({
      x: 6200000, y: 2100000, w: 5392000, h: 2500000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'NUMERIC VERIFICATION', size: 11, bold: true, color: '10B981' }] },
        { runs: [{ text: '5% Relaxed Tolerance Rule', size: 18, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Extracts numeric values: percentages, currencies, floats, and integers.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Formula: relativeError = |given - target| / |target| <= 0.05', size: 13, bold: true, color: '10B981' }] },
        { runs: [{ text: '• Filters out calendar years (1900-2099) and ordinals (Q1-Q4).', size: 13, color: '94A3B8' }] }
      ]
    }),
    // 4 Badges
    createShape({
      x: 600000, y: 4800000, w: 2550000, h: 1300000, fill: '0B1A12', border: '10B981', radius: 1,
      textRuns: [
        { runs: [{ text: 'SUPPORTED 🟢', size: 12, bold: true, color: '10B981' }] },
        { runs: [{ text: 'Directly backed by extracted visual table/pixel evidence.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 3400000, y: 4800000, w: 2550000, h: 1300000, fill: '1A150A', border: 'F59E0B', radius: 1,
      textRuns: [
        { runs: [{ text: 'SUBTLE CONFLICT 🟡', size: 12, bold: true, color: 'F59E0B' }] },
        { runs: [{ text: 'Minor rounding discrepancy or slight unit mismatch.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 6200000, y: 4800000, w: 2550000, h: 1300000, fill: '1F0A0D', border: 'EF4444', radius: 1,
      textRuns: [
        { runs: [{ text: 'EVIDENT CONFLICT 🔴', size: 12, bold: true, color: 'EF4444' }] },
        { runs: [{ text: 'Directly contradicts values explicitly displayed in evidence.', size: 11, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 9000000, y: 4800000, w: 2592000, h: 1300000, fill: '140A1E', border: 'A855F7', radius: 1,
      textRuns: [
        { runs: [{ text: 'BASELESS CLAIM 🟣', size: 12, bold: true, color: 'C084FC' }] },
        { runs: [{ text: 'Asserts entities or trends nowhere found in source document.', size: 11, color: '94A3B8' }] }
      ]
    })
  ];

  // Slide 7: Mitigation
  const slide7 = [
    ...makeSlideHeader('Mitigation Loop · Stage 07 Deep Dive', 'Mitigation & Self-Correction Strategy', 'Constrained re-prompting and measurable hallucination reduction', 7),
    createShape({
      x: 600000, y: 2100000, w: 5300000, h: 2800000,
      fill: '1A0C10', border: 'EF4444', radius: 1,
      textRuns: [
        { runs: [{ text: 'BEFORE MITIGATION', size: 11, bold: true, color: 'EF4444' }] },
        { runs: [{ text: 'Exploratory Generation Mode', size: 18, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Model fills in ambiguous chart details with parametric memory.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Extrapolates speculative historical background.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Hallucination rate reaches 25% - 40% on complex paper diagrams.', size: 13, bold: true, color: 'EF4444' }] }
      ]
    }),
    createShape({
      x: 6200000, y: 2100000, w: 5392000, h: 2800000,
      fill: '0B1F16', border: '10B981', radius: 1,
      textRuns: [
        { runs: [{ text: 'AFTER MITIGATION PASS', size: 11, bold: true, color: '10B981' }] },
        { runs: [{ text: 'Strict Verification Mode', size: 18, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Re-prompts under strict evidence boundary clause.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Requires model to cite observable image pixels directly.', size: 13, color: '94A3B8' }] },
        { runs: [{ text: '• Hallucination rate drops by over 60% relative reduction.', size: 13, bold: true, color: '10B981' }] }
      ]
    }),
    createShape({
      x: 600000, y: 5100000, w: 3450000, h: 1000000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { align: 'ctr', runs: [{ text: '-66.7%', size: 24, bold: true, color: '10B981' }] },
        { align: 'ctr', runs: [{ text: 'RELATIVE REDUCTION IN CHARTQA', size: 10, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 4350000, y: 5100000, w: 3450000, h: 1000000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { align: 'ctr', runs: [{ text: '94.2%', size: 24, bold: true, color: '818CF8' }] },
        { align: 'ctr', runs: [{ text: 'GROUNDED CLAIM ACCURACY', size: 10, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 8100000, y: 5100000, w: 3492000, h: 1000000, fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { align: 'ctr', runs: [{ text: '< 1.8s', size: 24, bold: true, color: '06B6D4' }] },
        { align: 'ctr', runs: [{ text: 'AVERAGE MITIGATION LATENCY', size: 10, color: '94A3B8' }] }
      ]
    })
  ];

  // Slide 8: EvidentAI Platform
  const slide8 = [
    ...makeSlideHeader('Interactive Prototype · Production Engineering', 'EvidentAI — The Live Assistant Platform', 'Full-stack application translating research into practical software', 8),
    createShape({
      x: 600000, y: 2100000, w: 3450000, h: 3200000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'CONTINUOUS VISION CHAT', size: 11, bold: true, color: '818CF8' }] },
        { runs: [{ text: 'Multimodal Ingestion', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Ingests photos, financial charts, scientific diagrams, PDFs, and Word docs.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Retains image & dialogue context across multi-turn exchanges.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Drag-and-drop file upload with live client preview.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 4350000, y: 2100000, w: 3450000, h: 3200000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'VERIFICATION CONTROLS', size: 11, bold: true, color: '10B981' }] },
        { runs: [{ text: 'Strict Mode & Claim Audit', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• Strict Verification iOS toggle locking model to visual evidence.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• One-click "Verify Claims" button under every response.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Color-coded grounding badges with cited evidence snippets.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 8100000, y: 2100000, w: 3492000, h: 3200000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'PRODUCTION ARCHITECTURE', size: 11, bold: true, color: '06B6D4' }] },
        { runs: [{ text: 'Cloud & Speech Stack', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '• MongoDB Atlas cloud database sync with offline JSON fallback.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Web Speech API voice dictation with soundwave visualizer.', size: 12, color: '94A3B8' }] },
        { runs: [{ text: '• Tiered accounts (Starter, Plus, Pro, Ultra Pro) with quota tracking.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 600000, y: 5500000, w: 10992000, h: 600000,
      fill: '101626', border: '6366F1', radius: 1,
      textRuns: [{ runs: [{ text: 'GitHub Repository: https://github.com/bhardwaj3026/EvidentAI  |  Live at http://localhost:8080/', size: 13, bold: true, color: '818CF8' }] }]
    })
  ];

  // Slide 9: Results Table
  const slide9 = [
    ...makeSlideHeader('Experimental Validation · Empirical Proof', 'Key Results & Error Quantification', 'Measurable hallucination reduction across diverse benchmarks', 9),
    createShape({
      x: 600000, y: 2100000, w: 10992000, h: 3200000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'BENCHMARK EVALUATION SUMMARY TABLE', size: 12, bold: true, color: '818CF8' }] },
        { runs: [{ text: '\n• ChartQA (32.7K Samples):  Baseline Hallucination 24.6%  ->  Mitigated 8.2%  (-66.7% Drop, 91.4% Grounded)', size: 13, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '\n• ScienceQA (21K Samples):  Baseline Hallucination 16.2%  ->  Mitigated 5.1%  (-68.5% Drop, MC Faithfulness High)', size: 13, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '\n• SPIQA (270K Samples):     Baseline Hallucination 38.9%  ->  Mitigated 14.3% (-63.2% Drop, 84.6% Grounded)', size: 13, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: '\n• Live User Uploads:       Baseline Hallucination 29.1%  ->  Mitigated 9.8%  (-66.3% Drop, 88.9% Grounded)', size: 13, bold: true, color: '10B981' }] }
      ]
    }),
    createShape({
      x: 600000, y: 5500000, w: 5300000, h: 600000, fill: '101626', border: '6366F1', radius: 1,
      textRuns: [{ runs: [{ text: 'Insight 1: 40% of initial errors were arithmetic mistakes, not vision hallucinations.', size: 12, color: '94A3B8' }] }]
    }),
    createShape({
      x: 6200000, y: 5500000, w: 5392000, h: 600000, fill: '101626', border: '10B981', radius: 1,
      textRuns: [{ runs: [{ text: 'Insight 2: Strict evidence boundary prompting eliminates baseless extrapolation completely.', size: 12, color: '94A3B8' }] }]
    })
  ];

  // Slide 10: Conclusion
  const slide10 = [
    ...makeSlideHeader('Summary & Outlook · Capstone Defense', 'Conclusion & Research Contributions', 'Toward verifiable, explainable, and trustworthy multimodal artificial intelligence', 10),
    createShape({
      x: 600000, y: 2100000, w: 3450000, h: 2600000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'CONTRIBUTION 01', size: 11, bold: true, color: '10B981' }] },
        { runs: [{ text: '5-Error Taxonomy', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Formalized explicit boundary separating procedural reasoning and visual OCR failures from true parametric hallucination.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 4350000, y: 2100000, w: 3450000, h: 2600000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'CONTRIBUTION 02', size: 11, bold: true, color: '818CF8' }] },
        { runs: [{ text: '8-Stage Pipeline', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Engineered automated claim decomposition and 5% relaxed numeric auditing that cuts hallucination rates by ~67%.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 8100000, y: 2100000, w: 3492000, h: 2600000,
      fill: '0E131F', border: '1E293B', radius: 1,
      textRuns: [
        { runs: [{ text: 'CONTRIBUTION 03', size: 11, bold: true, color: '06B6D4' }] },
        { runs: [{ text: 'EvidentAI Assistant', size: 16, bold: true, color: 'FFFFFF' }] },
        { runs: [{ text: 'Deployed a full-stack interactive assistant with strict verification mode, MongoDB sync, and voice accessibility.', size: 12, color: '94A3B8' }] }
      ]
    }),
    createShape({
      x: 600000, y: 4900000, w: 10992000, h: 1200000,
      fill: '101626', border: '6366F1', radius: 1,
      textRuns: [
        { align: 'ctr', runs: [{ text: '"Trust in Artificial Intelligence comes from verifiable grounding, not blind confidence."', size: 18, bold: true, italic: true, color: 'FFFFFF' }] },
        { align: 'ctr', runs: [{ text: 'Thank you!  |  Q&A and Demonstration Session', size: 13, bold: true, color: '818CF8' }] }
      ]
    })
  ];

  const slidesData = [slide1, slide2, slide3, slide4, slide5, slide6, slide7, slide8, slide9, slide10];
  slidesData.forEach((slideShapes, idx) => {
    zip.file(`ppt/slides/slide${idx + 1}.xml`, buildSlideXml(slideShapes));
    zip.file(`ppt/slides/_rels/slide${idx + 1}.xml.rels`, SLIDE_RELS_XML);
  });

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const outPath = path.join(process.cwd(), 'EvidentAI_Capstone_Presentation.pptx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Successfully generated presentation: ${outPath} (${buffer.length} bytes)`);
}

generatePresentation().catch(err => {
  console.error("Failed to generate PPTX:", err);
});

