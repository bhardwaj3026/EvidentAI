import { getDatasetSamples } from './dataLoader.js';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to',
  'from', 'up', 'down', 'in', 'out', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'many', 'much'
]);

/**
 * Tokenizes text into normalized unigram & bigram terms.
 */
function tokenize(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOP_WORDS.has(w));

  const tokens = [...words];
  // Add bigrams for phrase matching
  for (let i = 0; i < words.length - 1; i++) {
    tokens.push(`${words[i]}_${words[i+1]}`);
  }
  return tokens;
}

/**
 * Computes TF-IDF vector representations and cosine similarity.
 */
export function retrieveEvidence(queryText, selectedSampleId = null, datasetName = 'chartqa', topK = 3) {
  const allSamples = getDatasetSamples(datasetName);

  // If user selected a specific sample directly (Manual Pick Mode)
  if (selectedSampleId) {
    const target = allSamples.find(s => s.id === selectedSampleId);
    if (target) {
      // Find top neighbors using TF-IDF for completeness
      const neighbors = computeTfidfMatches(target.question, allSamples, datasetName)
        .filter(m => m.sample.id !== selectedSampleId)
        .slice(0, topK - 1);

      return {
        mode: 'manual_selection',
        query: queryText || target.question,
        matches: [
          {
            sample: target,
            score: 1.0,
            matchLabel: 'Directly Selected Sample'
          },
          ...neighbors.map(n => ({
            sample: n.sample,
            score: n.score,
            matchLabel: 'Top Lexical Neighbor'
          }))
        ]
      };
    }
  }

  // Free-text Query Mode: TF-IDF Cosine Match
  const matches = computeTfidfMatches(queryText, allSamples, datasetName);
  const topMatches = matches.slice(0, topK);

  return {
    mode: 'free_text_retrieval',
    query: queryText,
    matches: topMatches.map((m, idx) => ({
      sample: m.sample,
      score: m.score,
      matchLabel: idx === 0 ? 'Top Match (Rank 1)' : `Candidate Match (Rank ${idx + 1})`
    }))
  };
}

function computeTfidfMatches(queryText, samples, datasetName) {
  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) {
    return samples.slice(0, 3).map(s => ({ sample: s, score: 0.10 }));
  }

  // Build document corpus from all sample questions & titles & table values
  const docTokens = samples.map(s => {
    const tableText = Array.isArray(s.table) 
      ? s.table.map(row => (Array.isArray(row) ? row.join(' ') : Object.values(row).join(' '))).join(' ')
      : '';
    const corpusText = `${s.question} ${s.title || ''} ${tableText}`;
    return tokenize(corpusText);
  });

  const numDocs = samples.length;

  // Calculate Document Frequency (DF) for each term
  const df = {};
  docTokens.forEach(tokens => {
    const uniqueTokens = new Set(tokens);
    uniqueTokens.forEach(t => {
      df[t] = (df[t] || 0) + 1;
    });
  });

  // Calculate IDF for terms
  const idf = {};
  Object.keys(df).forEach(t => {
    idf[t] = Math.log((numDocs + 1) / (df[t] + 1)) + 1;
  });

  // Compute query vector
  const queryTf = {};
  queryTokens.forEach(t => { queryTf[t] = (queryTf[t] || 0) + 1; });
  const queryVector = {};
  let queryNormSq = 0;
  Object.keys(queryTf).forEach(t => {
    const weight = queryTf[t] * (idf[t] || 1);
    queryVector[t] = weight;
    queryNormSq += weight * weight;
  });
  const queryNorm = Math.sqrt(queryNormSq);

  // Compute score for each sample doc
  const scores = samples.map((sample, idx) => {
    const tokens = docTokens[idx];
    const docTf = {};
    tokens.forEach(t => { docTf[t] = (docTf[t] || 0) + 1; });

    let dotProduct = 0;
    let docNormSq = 0;

    Object.keys(docTf).forEach(t => {
      const weight = docTf[t] * (idf[t] || 1);
      docNormSq += weight * weight;
      if (queryVector[t]) {
        dotProduct += queryVector[t] * weight;
      }
    });

    const docNorm = Math.sqrt(docNormSq);
    let cosineSim = 0;
    if (queryNorm > 0 && docNorm > 0) {
      cosineSim = dotProduct / (queryNorm * docNorm);
    }

    // Boost score if sample question shares core keyphrases
    const exactQuestionMatch = sample.question.toLowerCase().includes(queryText.toLowerCase()) || queryText.toLowerCase().includes(sample.question.toLowerCase());
    if (exactQuestionMatch) cosineSim = Math.min(1.0, cosineSim + 0.35);

    return {
      sample,
      score: Number(cosineSim.toFixed(4))
    };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  return scores;
}
