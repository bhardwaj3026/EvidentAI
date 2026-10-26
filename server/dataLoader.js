import fs from 'fs';
import path from 'path';

const DATA_ROOT = path.join(process.cwd(), 'data');

/**
 * Converts a 2D array or key-value table into a Markdown table string.
 */
export function formatTableToMarkdown(table) {
  if (!table || !Array.isArray(table) || table.length === 0) {
    return '_No tabular data extracted._';
  }

  // If table is 2D array
  if (Array.isArray(table[0])) {
    const headers = table[0];
    const rows = table.slice(1);
    
    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    rows.forEach(r => {
      md += '| ' + r.join(' | ') + ' |\n';
    });
    return md;
  }

  // If table is key-value object array
  if (typeof table[0] === 'object') {
    const keys = Object.keys(table[0]);
    let md = '| ' + keys.join(' | ') + ' |\n';
    md += '| ' + keys.map(() => '---').join(' | ') + ' |\n';
    table.forEach(rowObj => {
      md += '| ' + keys.map(k => rowObj[k] || '').join(' | ') + ' |\n';
    });
    return md;
  }

  return JSON.stringify(table);
}

/**
 * Exposes dataset discovery and sample loading.
 */
export function formatEvidenceForPrompt(sample) {
  if (!sample) return '_No evidence provided._';

  const type = getNormalizedSampleType(sample);

  switch (type) {
    case 'science_mc': {
      const lecture = sample.lecture || sample.hint || 'No lecture text provided.';
      const choicesText = Array.isArray(sample.choices) && sample.choices.length > 0
        ? sample.choices.map((c, idx) => `${String.fromCharCode(65 + idx)}) ${c}`).join('\n')
        : 'No choices listed.';
      return `Lecture:\n${lecture}\n\nOptions:\n${choicesText}`;
    }

    case 'paper_figure': {
      const caption = sample.figureCaption || sample.caption || 'No figure caption provided.';
      return `Figure Caption:\n${caption}`;
    }

    case 'chart_table':
    default: {
      return formatTableToMarkdown(sample.table);
    }
  }
}

/**
  * Helper to normalize sample evidence type.
  */
export function getNormalizedSampleType(sample) {
  if (!sample) return 'chart_table';
  if (sample.type === 'science_mc') return 'science_mc';
  if (sample.type === 'paper_figure') return 'paper_figure';
  return 'chart_table';
}

/**
 * Exposes dataset discovery and sample loading.
 */
export function getAllDatasets() {
  if (!fs.existsSync(DATA_ROOT)) return [];
  const entries = fs.readdirSync(DATA_ROOT, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => {
      const samplesFile = path.join(DATA_ROOT, e.name, 'samples.json');
      const hasSamples = fs.existsSync(samplesFile);
      let count = 0;
      let sampleType = 'chart_table';
      if (hasSamples) {
        try {
          const content = JSON.parse(fs.readFileSync(samplesFile, 'utf8'));
          count = content.length;
          if (content.length > 0 && content[0].type) {
            sampleType = getNormalizedSampleType(content[0]);
          }
        } catch (err) {}
      }
      
      let name = e.name.toUpperCase();
      if (e.name === 'chartqa') name = 'ChartQA Research Benchmark (Chart + Table)';
      else if (e.name === 'scienceqa') name = 'ScienceQA Benchmark (Lecture + Options)';
      else if (e.name === 'spiqa') name = 'SPIQA Benchmark (Figure + Caption)';

      return {
        id: e.name,
        name,
        type: sampleType,
        count,
        hasSamples
      };
    });
}

export function getDatasetSamples(datasetName = 'chartqa') {
  const samplesFile = path.join(DATA_ROOT, datasetName, 'samples.json');
  if (!fs.existsSync(samplesFile)) {
    throw new Error(`Dataset '${datasetName}' not found or samples.json missing.`);
  }

  const samples = JSON.parse(fs.readFileSync(samplesFile, 'utf8'));
  return samples.map(s => {
    const type = getNormalizedSampleType(s);
    const normalizedSample = { ...s, type };
    return {
      ...normalizedSample,
      markdownTable: formatTableToMarkdown(s.table),
      formattedEvidence: formatEvidenceForPrompt(normalizedSample)
    };
  });
}

export function getSampleById(sampleId, datasetName = 'chartqa') {
  const samples = getDatasetSamples(datasetName);
  const found = samples.find(s => s.id === sampleId);
  if (!found) {
    throw new Error(`Sample '${sampleId}' not found in dataset '${datasetName}'.`);
  }
  return found;
}

