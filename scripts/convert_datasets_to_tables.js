import fs from 'fs';
import path from 'path';

const DATA_ROOT = path.join(process.cwd(), 'capstone real', 'data');

// Helper to escape CSV fields
function toCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

// Convert 2D table array to Markdown table string
function formatTableToMarkdown(table) {
  if (!table || !Array.isArray(table) || table.length === 0) {
    return '_No tabular data extracted._';
  }
  if (Array.isArray(table[0])) {
    const headers = table[0];
    const rows = table.slice(1);
    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    rows.forEach(r => {
      md += '| ' + r.map(c => String(c).replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    });
    return md;
  }
  return JSON.stringify(table);
}

// -------------------------------------------------------------
// 1. SPIQA 20 Real Figures/Tables Extraction Definitions
// -------------------------------------------------------------
const spiqaTables = {
  "spiqa_real_000": [
    ["School", "Focus & Curriculum", "Specialization", "Educational Philosophy / Objective"],
    ["Bonaparte School", "Outdoor physical activities, maneuvers, strategies", "Horse riding, lances, swords", "Develop students into good leaders"],
    ["Voltaire School", "Indoor activities, independent thinking", "Philosophy, morality", "Instill good moral values, develop philosophical thinkers"]
  ],
  "spiqa_real_001": [
    ["Block", "Layer", "Operation / Formula", "Function Description"],
    ["Projection Block", "FRMap Layer", "X1 = f_fr(X0) = [W1^T X0, ...]", "First-order projection mapping from input orth X0"],
    ["Projection Block", "ReOrth Layer", "X2 = f_ro(X1) = Q1 (X1 = Q1 R1)", "Re-orthogonalizes the output of the FRMap Layer"],
    ["Pooling Block", "ProjMap Layer", "X3 = f_pm(X2) = X2 X2^T", "Projection mapping onto Grassmannian space"],
    ["Pooling Block", "ProjPooling Layer", "X4 = f_pp({X3^1, ...})", "Projection pooling across channels"],
    ["Pooling Block", "OrthMap Layer", "X5 = f_om(X4) = U_4,1:q", "Orthogonal mapping via SVD X4 = U4 Sigma4 U4^T"],
    ["Output Block", "ProjMap Layer", "X_{l-1} = f_pm(X_{l-2}) = X_{l-2} X_{l-2}^T", "Final block projection mapping"],
    ["Output Block", "FC & Softmax Layers", "f^(l)(X_{l-1})", "Fully connected classification & softmax probabilities"]
  ],
  "spiqa_real_002": [
    ["Network Architecture", "Depth", "Params", "CIFAR-10 Error (%)", "CIFAR-100 Error (%)", "SVHN Error (%)"],
    ["Network in Network [16]", "-", "-", "8.81", "-", "2.35"],
    ["All-CNN [25]", "-", "-", "7.25", "33.71", "-"],
    ["FitNet [21]", "-", "-", "8.39", "35.04", "2.42"],
    ["Deeply-Supervised Nets [15]", "-", "-", "7.97", "34.57", "1.92"],
    ["Swapout [23]", "20 / 32", "1.1M / 7.4M", "6.85 / 4.76", "25.86 / 22.72", "-"],
    ["Highway [27]", "-", "-", "7.72", "32.39", "-"],
    ["DFN [35]", "50 / 50", "3.7M / 3.9M", "6.40 / 6.24", "27.61 / 27.52", "-"],
    ["FractalNet [14] (W/ dropout & droppath)", "21", "38.6M", "5.22 / 4.60", "23.30 / 23.73", "2.01 / 1.87"],
    ["ResNet [7, 10, 8]", "110 / 164 / 1001", "1.7M / 10.2M", "6.61 / 5.46 / 4.62", "27.22 / 24.33 / 22.71", "2.01 / -"],
    ["ResNet W/ stochastic depth [10]", "110 / 1202", "1.7M / 10.2M", "5.23 / 4.91", "24.58 / -", "1.75 / -"],
    ["Wide ResNet [39] (W/ dropout)", "16 / 28", "11.0M / 36.5M", "4.81 / 4.17", "22.07 / 20.50", "1.64"],
    ["RiR [32]", "18", "10.3M", "5.01", "22.90", "-"],
    ["Multi-ResNet [1]", "200 / 398", "10.2M / 20.4M", "4.35 / 3.92", "20.42 / -", "-"],
    ["DenseNet [9]", "100", "27.2M", "3.74", "19.25", "1.59"],
    ["DMRNet (ours)", "56", "1.7M", "4.96", "24.41", "1.68"],
    ["DMRNet-Wide (ours, 4x wider)", "32", "14.9M", "3.94", "19.25", "1.51"],
    ["DMRNet-Wide (ours, 4x wider)", "50", "24.8M", "3.57", "19.00", "1.55"]
  ],
  "spiqa_real_003": [
    ["User Segment", "GeoCUTS B-metric", "DMA B-metric", "Grid B-metric"],
    ["US Highly Active", "1.5", "1.5", "1.5"],
    ["US Highly Mobile", "1.8", "1.7", "1.3"],
    ["France Highly Active", "11.1", "-", "11.5"]
  ],
  "spiqa_real_004": [
    ["Method", "Agg", "QA-Expert P@1", "QA-Expert P@3", "QA-Expert P@5", "QA-Expert MAP", "QA-Expert Rprec", "Paper-Reviewer P@3", "Paper-Reviewer P@5", "Paper-Reviewer P@10", "Paper-Reviewer MAP", "Paper-Reviewer Rprec"],
    ["LM", "max", "36.8", "34.9", "33.2", "57.4", "55.7", "66.5", "61.6", "54.7", "76.7", "67.2"],
    ["LM", "avg", "37.5", "36.8", "33.2", "57.9", "55.6", "69.9", "63.3", "54.9", "78.2", "68.3"],
    ["BM25", "max", "33.6", "33.6", "33.3", "55.1", "53.5", "67.1", "61.8", "54.8", "77.0", "67.1"],
    ["BM25", "avg", "41.4", "34.6", "33.3", "59.1", "56.5", "70.2", "63.9", "55.1", "78.1", "68.4"],
    ["LDA", "max", "37.5", "35.3", "33.2", "56.7", "53.9", "63.0", "59.3", "54.1", "72.8", "65.6"],
    ["LDA", "avg", "32.9", "33.8", "32.9", "53.6", "51.4", "66.3", "62.6", "55.2", "75.8", "67.9"],
    ["WMD", "max", "40.8", "36.4", "34.0", "59.5", "56.2", "67.3", "61.5", "54.6", "76.3", "67.2"],
    ["WMD", "avg", "38.2", "38.2", "34.1", "58.8", "55.6", "64.2", "59.3", "53.0", "73.7", "63.5"],
    ["D2V", "max", "36.2", "34.4", "33.2", "57.3", "55.6", "69.6", "62.5", "55.1", "77.7", "68.3"],
    ["D2V", "avg", "29.6", "32.7", "33.3", "53.9", "53.0", "72.3", "65.4", "56.2", "80.5", "71.3"],
    ["RankSVM", "-", "49.8", "38.5", "33.7", "65.5", "63.1", "70.6", "64.8", "56.0", "81.0", "72.7"],
    ["WeakFG (Ours)", "-", "52.8", "39.6", "34.1", "67.4", "64.5", "71.9", "65.5", "56.3", "82.0", "73.8"]
  ],
  "spiqa_real_005": [
    ["System Source", "Model Variant", "BLEU Score", "METEOR Score"],
    ["Ortiz et al.", "LBL", "7.3", "17.7"],
    ["Ortiz et al.", "MLBL", "12.3", "20.4"],
    ["Ortiz et al.", "Image", "12.8", "21.7"],
    ["Ortiz et al.", "Keyword", "14.7", "26.6"],
    ["Ortiz et al.", "Template", "40.3", "30.4"],
    ["Ortiz et al.", "SMT", "43.7", "35.6"],
    ["Proposed Method", "CCA (m=120, eta=0.05)", "26.1", "25.6"]
  ],
  "spiqa_real_006": [
    ["Model Group", "Model Name", "SICK Pearson r", "SICK Spearman rho", "SICK MSE", "MSRP Accuracy (%)", "MSRP F1 (%)"],
    ["Supervised", "Supervised Method", "0.868", "0.808", "0.253", "80.4", "86.0"],
    ["Prior Work", "Uni-ST (Kiros et al. 2015)", "0.848", "0.778", "0.287", "73.0", "81.9"],
    ["Our Models", "Ordering model", "0.807", "0.742", "0.356", "72.3", "81.1"],
    ["Our Models", "Ordering model + BoW", "0.842", "0.775", "0.299", "74.0", "81.9"],
    ["Our Models", "Ordering model + Uni-ST", "0.860", "0.795", "0.270", "74.9", "82.5"]
  ],
  "spiqa_real_007": [
    ["Shape Parameter alpha", "IRLS Weight Curve Profile", "Psi Function Curve Profile at z->0"],
    ["alpha = -infinity", "Most narrow, sharply concentrated peak at x=0", "Begins at value 1, gradual decay"],
    ["alpha = -2", "Concentrated peak at x=0, rapid taper", "Rises to value ~2"],
    ["alpha = 0", "Moderate bell peak", "Rises to value ~3"],
    ["alpha = 0.5", "Wider bell peak", "Steep upward ascent toward z=0"],
    ["alpha = 1.0", "Broad bell curve", "Very steep upward ascent toward z=0"],
    ["alpha = 1.5", "Very broad dispersion across x", "Extremely steep asymptotic rise"],
    ["alpha = 2.0", "Completely flat horizontal line at 1/c^2", "Vertical asymptote at z=0"]
  ],
  "spiqa_real_008": [
    ["Hour of the Day", "Number of Network-Related Reboots"],
    ["00:00", "12"],
    ["01:00", "8"],
    ["02:00", "15"],
    ["03:00", "3"],
    ["04:00", "1"],
    ["05:00", "20"],
    ["06:00", "9"],
    ["07:00", "2"],
    ["08:00", "19"],
    ["09:00", "6"],
    ["10:00", "3"],
    ["11:00", "9"],
    ["12:00", "4"],
    ["13:00", "6"],
    ["14:00", "11"],
    ["15:00", "9"],
    ["16:00", "6"],
    ["17:00", "11"],
    ["18:00", "6"],
    ["19:00", "3"],
    ["20:00", "17"],
    ["21:00", "4"]
  ],
  "spiqa_real_009": [
    ["Cake Cutting Component", "Visual Symbol", "Valuation / Interpretation"],
    ["Agent j's Share (Z_j)", "Solid Blue Rectangles", "Agent j values entire slice with positive density v_j"],
    ["Other Agents' Shares (Z_i)", "Dotted Color Outlines (Green, Purple, Red, Orange)", "Agent j assigns 0 density to other agents' pieces"],
    ["Overall Allocation", "Alternating Intervals along cake length", "Exact envy-free fair division structure"]
  ],
  "spiqa_real_010": [
    ["Architecture Phase", "Module / Component", "Input / Predecessor", "Output / Function"],
    ["Training Phase", "Input Features", "e_t, q_t (dataset state)", "State fed into LSTM layer 1"],
    ["Training Phase", "LSTM Stack (H1, H2, H3)", "Sequential feedback & time steps", "Multi-layer recurrent representations"],
    ["Training Phase", "Mixture Density Parameters (M)", "Hidden representations", "Parameters alpha (Softmax), mu, sigma (Exp)"],
    ["Training Phase", "Cost Function (C)", "Mixture parameters vs e_{t+1}..e_{t+50}", "Negative log likelihood loss backpropagated"],
    ["Evaluation Phase", "Recurrent Closed-Loop", "e_t, q_t + previous state", "Multivariate Mixture of Gaussians"],
    ["Evaluation Phase", "Actuation Pipeline", "Sampled e_{t+1}", "Inverse kinematics -> Joint angles -> Robot execution"]
  ],
  "spiqa_real_011": [
    ["Policy Name", "Average Cost", "% Episodes Cost 0-20", "% Episodes Cost 20-70", "% Episodes Cost >=70"],
    ["ALOQ Policy", "19.82", "61.3%", "38.5%", "0.2%"],
    ["MAP Policy", "28.76", "67.1%", "28.7%", "4.2%"],
    ["RQ-ALOQ", "25.95", "-", "94.5%", "5.5%"]
  ],
  "spiqa_real_012": [
    ["Physical Concept", "Mathematical Expression", "Physical Variable / Parameter", "Physical Implication"],
    ["Equation of Motion", "m \\ddot{X} + K X = 0", "\\ddot{X} := d^2X/dt^2 (acceleration)", "Newton's second law for frictionless harmonic oscillator"],
    ["Position Function", "X(t) = x_0 \\cos(\\omega t)", "x_0 (initial release displacement), t (time)", "Periodic oscillatory displacement from equilibrium"],
    ["Oscillating Frequency", "\\omega = \\sqrt{K/m}", "K (spring constant), m (particle mass)", "Natural frequency determined by stiffness and mass"],
    ["Kinetic Energy", "K(X) = 0.5 m \\dot{X}^2", "\\dot{X} (velocity of particle)", "Kinetic component of mechanical energy"],
    ["Conservation of Energy", "E(t) := V(X(t)) + K(X(t)) = V(x_0)", "E(t) (total energy)", "Total energy is strictly conserved; system never stops"]
  ],
  "spiqa_real_013": [
    ["Bayes Net Structure", "Algorithm", "Error (d_TV) at m=100", "Error (d_TV) at m=500", "Error (d_TV) at m=1000", "Trend Summary"],
    ["Random Tree (Left)", "MLE w/o noise", "0.01", "0.01", "0.01", "Near-zero baseline error"],
    ["Random Tree (Left)", "Filtering (Ours)", "0.02", "0.02", "0.02", "Consistently robust across parameter sizes"],
    ["Random Tree (Left)", "MLE w/ noise", "0.48", "0.85", "0.96", "Error increases severely with table size m"],
    ["Random Tree (Left)", "RANSAC", "0.45", "0.84", "0.95", "Error degrades rapidly similarly to MLE"],
    ["Random Graph (Right)", "MLE w/o noise", "0.01", "0.01", "0.01", "Near-zero baseline error"],
    ["Random Graph (Right)", "Filtering (Ours)", "0.02", "0.02", "0.02", "Remains tightly bounded near zero"],
    ["Random Graph (Right)", "MLE w/ noise", "0.40", "0.50", "0.46", "Persistently high error (~0.40 - 0.50)"],
    ["Random Graph (Right)", "RANSAC", "0.38", "0.49", "0.45", "Persistently high error (~0.38 - 0.49)"]
  ],
  "spiqa_real_014": [
    ["Attack Method", "Gradient Based?", "Word-level RNN?", "Sequential Output?", "Targeted Attack Type"],
    ["Ebrahimi et al. (2017)", "Yes", "No", "Yes", "Class"],
    ["Jia and Liang (2017)", "No", "Yes", "No", "None (Untargeted)"],
    ["Li, Monroe, and Jurafsky (2016)", "Yes", "Yes", "No", "Class"],
    ["Papernot et al. (2016)", "Yes", "No", "Yes", "None (Untargeted)"],
    ["Gao et al. (2018)", "No", "Yes", "No", "Binary"],
    ["Samanta and Mehta (2017)", "No", "No", "No", "Binary"],
    ["Zhao, Dua, and Singh (2017)", "Yes", "Yes", "Yes", "Class"],
    ["Liang et al. (2017)", "Yes", "No", "No", "Class"],
    ["Alzantot et al. (2018)", "No", "Yes", "No", "Class"],
    ["Yang et al. (2018)", "No", "Yes", "No", "Class"],
    ["Seq2Sick (Ours)", "Yes", "Yes", "Yes", "Keyword"]
  ],
  "spiqa_real_015": [
    ["Trade Time Index (t)", "Predecessor Index s(t)", "Independent Noise Vector", "Cumulative Noise in q_hat_t", "Maximum Backwards Jumps"],
    ["t = 0", "-", "z_0", "z_0", "0 jumps"],
    ["t = 1", "0", "z_1", "z_1 + z_0", "1 jump"],
    ["t = 2", "0", "z_2", "z_2 + z_0", "1 jump"],
    ["t = 3", "2", "z_3", "z_3 + z_2 + z_0", "2 jumps"],
    ["t = 4", "0", "z_4", "z_4 + z_0", "1 jump"],
    ["t = 5", "4", "z_5", "z_5 + z_4 + z_0", "2 jumps"],
    ["t = 6", "4", "z_6", "z_6 + z_4 + z_0", "2 jumps"],
    ["t = 7", "6", "z_7", "z_7 + z_6 + z_4 + z_0", "3 jumps"],
    ["t = 8", "0", "z_8", "z_8 + z_0", "1 jump"],
    ["t = 16", "0", "z_16", "z_16 + z_0", "1 jump"]
  ],
  "spiqa_real_016": [
    ["Data Split", "Model", "MSRP (Acc / F1)", "MR", "CR", "SUBJ", "MPQA", "TREC", "Average"],
    ["Unordered Sentences", "SAE", "74.3 / 81.7", "62.6", "68.0", "86.1", "76.8", "80.2", "74.7"],
    ["Unordered Sentences", "SAE + embs.", "70.6 / 77.9", "73.2", "75.3", "89.8", "86.2", "80.4", "79.3"],
    ["Unordered Sentences", "SDAE", "76.4 / 83.4", "67.6", "74.0", "89.3", "81.3", "77.7", "78.3"],
    ["Unordered Sentences", "SDAE + embs.", "73.7 / 80.7", "74.6", "78.0", "90.8", "86.9", "78.4", "80.4"],
    ["Unordered Sentences", "ParagraphVec DBOW", "72.9 / 81.1", "60.2", "66.9", "76.3", "70.7", "59.4", "67.7"],
    ["Unordered Sentences", "ParagraphVec DM", "73.6 / 81.9", "61.5", "68.6", "76.4", "78.1", "55.8", "69.0"],
    ["Unordered Sentences", "Skipgram", "69.3 / 77.2", "73.6", "77.3", "89.2", "85.0", "82.2", "78.5"],
    ["Unordered Sentences", "C-BOW", "67.6 / 76.1", "73.6", "77.3", "89.1", "85.0", "82.2", "79.1"],
    ["Unordered Sentences", "Unigram TFIDF", "73.6 / 81.7", "73.7", "79.2", "90.3", "82.4", "85.0", "80.7"],
    ["Unordered Sentences", "Sent2Vec uni.", "72.2 / 80.3", "75.1", "80.2", "90.6", "86.3", "83.8", "81.4"],
    ["Unordered Sentences", "Sent2Vec uni. + bi.", "72.5 / 80.8", "75.8", "80.3", "91.2", "85.9", "86.4", "82.0"],
    ["Ordered Sentences", "SkipThought", "73.0 / 82.0", "76.5", "80.1", "93.6", "87.1", "92.2", "83.8"],
    ["Ordered Sentences", "FastSent", "72.2 / 80.3", "70.8", "78.4", "88.7", "80.6", "76.8", "77.9"],
    ["Ordered Sentences", "FastSent+AE", "71.2 / 79.1", "71.8", "76.7", "88.8", "81.5", "80.4", "78.4"],
    ["2.8 Billion words", "C-PHRASE", "72.2 / 79.6", "75.7", "78.8", "91.1", "86.2", "78.8", "80.5"]
  ],
  "spiqa_real_017": [
    ["Stage", "Layer Name / Spec", "Input Source", "Residual Skip Connection Target", "Output Resolution / Channel"],
    ["1", "Conv 128 x 3 x 3, stride 1", "Relation Features", "Skips to Layer 10 (addition)", "128 channels"],
    ["2", "Conv 192 x 3 x 3, stride 2", "Layer 1 output", "Skips to Layer 9 (addition)", "192 channels, stride 2"],
    ["3", "Conv 256 x 3 x 3, stride 2", "Layer 2 output", "Skips to Layer 8 (addition)", "256 channels, stride 2"],
    ["4", "Conv 320 x 3 x 3, stride 2", "Layer 3 output", "Skips to Layer 7 (addition)", "320 channels, stride 2"],
    ["5", "Conv 512 x 3 x 3, stride 2", "Layer 4 output", "Skips to Layer 6 (addition)", "512 channels, bottleneck"],
    ["6", "Conv 512 x 3 x 3, stride 1", "Layer 5 + skip from Layer 5", "Upsample x2", "512 channels"],
    ["7", "Conv 320 x 3 x 3, stride 1", "Upsample + skip from Layer 4", "Upsample x2", "320 channels"],
    ["8", "Conv 256 x 3 x 3, stride 1", "Upsample + skip from Layer 3", "Upsample x2", "256 channels"],
    ["9", "Conv 196 x 3 x 3, stride 1", "Upsample + skip from Layer 2", "Upsample x2", "196 channels"],
    ["10", "Conv 128 x 3 x 3, stride 1", "Upsample + skip from Layer 1", "Direct to Layer 11", "128 channels"],
    ["11", "Conv 64 x 3 x 3, stride 1", "Layer 10 output", "Direct to Layer 12", "64 channels"],
    ["12", "Conv 2 x 3 x 3, stride 1", "Layer 11 output", "Final Optical Flow", "2 channels (Flow vectors)"]
  ],
  "spiqa_real_018": [
    ["CPU Time (seconds)", "Observed Error", "Underlying True Error", "Error Gap (Observed - True)"],
    ["0.00", "1.00e+0", "1.00e+0", "0.00"],
    ["0.12", "9.50e-3", "1.00e-2", "-5.00e-4"],
    ["0.25", "1.80e-3", "2.70e-3", "-9.00e-4"],
    ["0.38", "1.10e-3", "1.90e-3", "-8.00e-4"],
    ["0.50", "9.00e-4", "1.60e-3", "-7.00e-4"],
    ["0.75", "7.30e-4", "1.40e-3", "-6.70e-4"],
    ["1.00", "6.50e-4", "1.30e-3", "-6.50e-4"],
    ["1.50", "5.80e-4", "1.20e-3", "-6.20e-4"],
    ["2.00", "5.50e-4", "1.10e-3", "-5.50e-4"],
    ["2.35", "5.30e-4", "1.10e-3", "-5.70e-4"]
  ],
  "spiqa_real_019": [
    ["Dataset Name", "Positive Samples", "Negative Samples", "Training Split", "Development Split", "Test Split", "Total Samples"],
    ["CNSE", "12,865", "16,198", "17,438", "5,813", "5,812", "29,063"],
    ["CNSS", "16,887", "16,616", "20,102", "6,701", "6,700", "33,503"]
  ]
};

// -------------------------------------------------------------
// 2. ScienceQA 50 Real Diagram / Experiment / Map Extraction Definitions
// -------------------------------------------------------------
const scienceqaTables = {
  "scienceqa_real_000": [
    ["Design Test Parameter", "Experimental Value", "Measurement Goal"],
    ["Tested Prototype", "Parachute with 1 m vent", "Vent size aerodynamic stability"],
    ["Wind Tunnel Air Speed", "200 km per hour", "Simulated high-speed Mars descent entry"],
    ["Observed Measurement", "Swing magnitude / steadiness", "Determine if parachute swings wildly or remains steady"]
  ],
  "scienceqa_real_001": [
    ["Colony / Territory", "Colonial Status", "Bordering Regions", "Key Geographical Detail"],
    ["New Hampshire", "Highlighted Colony", "Bordered by Massachusetts, New York / Vermont territory", "Northern New England 13 original colonies"],
    ["Vermont", "Not independent colony", "Claimed by New Hampshire & New York", "Inland green territory"],
    ["Rhode Island", "Colony", "South of Massachusetts", "Smallest coastal colony"],
    ["Maryland", "Colony", "Chesapeake Bay region", "Mid-Atlantic colony"]
  ],
  "scienceqa_real_002": [
    ["Organism", "Trophic Level / Role", "Food Source (Eats)", "Consumed By (Arrow Points To)"],
    ["lichen", "Producer / Symbiont", "Sunlight & mineral nutrients", "collared lemming, barren-ground caribou"],
    ["bilberry", "Producer", "Sunlight", "Arctic fox, barren-ground caribou"],
    ["bear sedge", "Producer", "Sunlight", "collared lemming, barren-ground caribou"],
    ["collared lemming", "Primary Consumer", "lichen, bear sedge", "Arctic fox"],
    ["barren-ground caribou", "Primary Consumer", "lichen, bear sedge, bilberry", "grizzly bear, mushroom (post-mortem)"],
    ["mushroom", "Decomposer / Fungi", "Matter from dead lichen, caribou & organic detritus", "Decomposes matter back to soil nutrients"],
    ["earthworm", "Decomposer", "Soil organic matter", "Arctic fox"],
    ["Arctic fox", "Secondary Consumer", "collared lemming, earthworm, bilberry", "grizzly bear"],
    ["grizzly bear", "Apex Predator", "barren-ground caribou, Arctic fox", "-"]
  ],
  "scienceqa_real_003": [
    ["Parent Genotypes", "Allele 1 (f)", "Allele 2 (f)"],
    ["Parent 1 Allele (f)", "ff (woolly fleece)", "ff (woolly fleece)"],
    ["Parent 2 Allele (f)", "ff (woolly fleece)", "ff (woolly fleece)"],
    ["Phenotype Summary", "Woolly fleece (ff): 4 boxes", "Hairy fleece: 0 boxes (Ratio 4:0 / 100%)"]
  ],
  "scienceqa_real_004": [
    ["Object", "Shiny?", "Slippery?", "Opaque (Does not transmit light)?"],
    ["tortoise shell", "No", "No", "Yes (Opaque)"],
    ["crown", "Yes (Gold metal)", "No", "Yes (Opaque)"],
    ["basketball", "No", "No", "Yes (Opaque)"],
    ["Common Attribute", "Not all shiny", "Not slippery", "All three objects are Opaque"]
  ],
  "scienceqa_real_005": [
    ["Pair", "Block Magnet Size", "Horseshoe Magnet Size", "Distance", "Relative Magnetic Force Magnitude"],
    ["Pair 1", "Large block magnet", "Large horseshoe magnet", "2.25 inches", "Stronger magnetic force (larger magnet volume)"],
    ["Pair 2", "Large block magnet", "Small horseshoe magnet", "2.25 inches", "Smaller magnetic force (smaller magnet volume)"]
  ],
  "scienceqa_real_006": [
    ["US State", "Capital City", "Location / Geographic Feature", "Highlighted in Map"],
    ["Wyoming", "Cheyenne", "Western US / Rocky Mountain state", "State highlighted in green with star at Cheyenne"],
    ["Arizona", "Phoenix", "Southwestern US", "Not highlighted"],
    ["Louisiana", "Baton Rouge", "Southern US / Gulf Coast", "Not highlighted"],
    ["Hawaii", "Honolulu", "Pacific island chain", "Not highlighted"]
  ],
  "scienceqa_real_007": [
    ["Planet", "Volume Relative to Earth", "Primary Composition", "Category"],
    ["Jupiter", "1,321 (Largest Planet)", "Gas (Hydrogen & Helium)", "Gas Giant"],
    ["Saturn", "764", "Gas (Hydrogen & Helium)", "Gas Giant"],
    ["Uranus", "63", "Ice & Gas (Water, Ammonia, Methane)", "Ice Giant"],
    ["Neptune", "58", "Ice & Gas", "Ice Giant"],
    ["Earth", "1.0", "Rock & Metal", "Terrestrial Planet"]
  ],
  "scienceqa_real_008": [
    ["Organism", "Ecosystem Role", "Primary Trophic Level", "Diet / Arrows"],
    ["green algae", "Producer", "Primary Producer", "Photosynthesis; eaten by rotifer, copepod"],
    ["copepod", "Primary Consumer", "Herbivore / Zooplankton", "Consumes green algae; eaten by yellow perch"],
    ["rotifer", "Primary Consumer", "Herbivore / Zooplankton", "Consumes green algae"],
    ["black crappie", "Secondary / Tertiary Consumer", "Carnivore", "Eats smaller fish"],
    ["bacteria", "Decomposer", "Decomposer", "Recycles organic waste"]
  ],
  "scienceqa_real_009": [
    ["Magnet Pair", "Magnet Poles Facing", "Separation Distance", "Magnetic Force Strength"],
    ["Pair 1", "North pole facing South pole", "1.50 inches (Closer)", "Stronger magnetic force (inversely related to distance)"],
    ["Pair 2", "North pole facing South pole", "2.75 inches (Farther)", "Weaker magnetic force"]
  ],
  "scienceqa_real_010": [
    ["Ecosystem Feature", "Daintree Rain Forest", "Boreal Forest / Taiga", "Observed Ecological Property"],
    ["Climate / Precipitation", "Year-round rain, high humidity", "Seasonal rain, heavy snow", "Tropical wet rainforest environment"],
    ["Soil Nutrient Profile", "Nutrient-poor (rapid leaching)", "Acidic, slow decomposition", "Nutrients stored in biomass, not soil"],
    ["Winter Temperature", "Warm year-round", "Extremely cold freezing winters", "Continuous growing season"]
  ],
  "scienceqa_real_011": [
    ["State", "Capital", "Geographic Region", "Statehood"],
    ["Delaware", "Dover", "Mid-Atlantic / Delmarva Peninsula", "First US State (1787) - Highlighted on map"],
    ["Vermont", "Montpelier", "New England", "Not highlighted"],
    ["New Jersey", "Trenton", "Mid-Atlantic", "Not highlighted"]
  ],
  "scienceqa_real_012": [
    ["State Name", "Latitude Range", "Relative Geographic Position", "Map Highlight"],
    ["Maine", "43 deg 04' N - 47 deg 28' N", "Farthest North among options", "Northeastern-most state (Highlighted)"],
    ["Delaware", "38 deg 27' N - 39 deg 50' N", "Mid-Atlantic latitude", "South of Maine"],
    ["Kansas", "37 deg 00' N - 40 deg 00' N", "Central Plains latitude", "South of Maine"],
    ["South Carolina", "32 deg 02' N - 35 deg 13' N", "Southeastern latitude", "Farthest South"]
  ],
  "scienceqa_real_013": [
    ["Trader", "Current Item Owned", "Desired Item", "Optimal Mutual Trade"],
    ["Greta", "Tomatoes", "Broccoli", "Greta gives tomatoes to Allie"],
    ["Allie", "Broccoli", "Tomatoes", "Allie gives broccoli to Greta"]
  ],
  "scienceqa_real_014": [
    ["State", "Capital", "Elevation / Region", "Map Status"],
    ["Colorado", "Denver", "Rocky Mountain Region / Mile High City", "Highlighted in green with red star at Denver"],
    ["Wyoming", "Cheyenne", "Rocky Mountain Region", "North border"],
    ["Utah", "Salt Lake City", "Great Basin / Rockies", "West border"]
  ],
  "scienceqa_real_015": [
    ["Continent", "Land Area (M sq km)", "Highlighted Status", "Key Boundary"],
    ["Asia", "44.58 (Largest continent)", "Highlighted in bright green", "Bordered by Ural Mtns, Pacific Ocean, Indian Ocean"],
    ["Europe", "10.18", "Not highlighted (Grey)", "West of Ural Mountains"],
    ["Africa", "30.37", "Not highlighted (Grey)", "Southwest of Suez Canal"]
  ],
  "scienceqa_real_016": [
    ["Experimental Component", "Chase's Setup", "Role in Scientific Method"],
    ["Feeder 1", "Sunflower seeds", "Independent variable condition A"],
    ["Feeder 2", "Flax seeds", "Independent variable condition B"],
    ["Cardinal Bird Visits", "Observed count of visits per feeder", "Dependent variable (Visit frequency)"],
    ["Best Answered Question", "Do cardinals visit feeders containing sunflower seeds more often than flax seeds?", "Primary experimental hypothesis"]
  ],
  "scienceqa_real_017": [
    ["Material / Surface", "Visual Texture & Color", "Material Class", "Present in Photo"],
    ["brick", "Red-brown rectangular fired clay units with mortar joints", "Masonry ceramic", "Yes - walkway path is laid brick"],
    ["asphalt", "Black tar aggregate", "Petroleum paving", "No"],
    ["wood", "Grain planks", "Organic timber", "No"]
  ],
  "scienceqa_real_018": [
    ["Organism Shown", "Taxonomic Class", "Distinguishing Features", "Is a Bird?"],
    ["ostrich", "Aves (Bird)", "Feathers, beak, wings, lays eggs", "Yes (Flightless bird)"],
    ["koala", "Mammalia (Marsupial)", "Fur, pouch, mammary glands", "No"],
    ["chameleon", "Reptilia", "Scales, cold-blooded, prehensile tail", "No"]
  ],
  "scienceqa_real_019": [
    ["Object", "Visual Color", "Shape / Texture", "Property in Common"],
    ["blue marble", "Blue", "Smooth sphere", "Blue color"],
    ["blue ribbon", "Blue", "Flexible fabric", "Blue color"],
    ["blue button", "Blue", "Flat disc with holes", "Blue color"],
    ["Shared Feature", "All three objects are Blue", "Different shapes and materials", "Color property: Blue"]
  ],
  "scienceqa_real_020": [
    ["Variable Type", "Variable in Experiment", "Measurement Units / Method", "Controlled Status"],
    ["Independent Variable", "Soil temperature / light exposure", "Experimental groups", "Manipulated by researcher"],
    ["Dependent Variable", "Number of days until seed germinated", "Days (Time to germination)", "Measured outcome variable"],
    ["Controlled Variable", "Water volume, seed type, soil volume", "Constant across pots", "Kept uniform"]
  ],
  "scienceqa_real_021": [
    ["US State", "Capital City", "Region", "Highlighted Map Marker"],
    ["Mississippi", "Jackson", "Deep South / Gulf Coast", "State in green with star at Jackson"],
    ["Alabama", "Montgomery", "East of Mississippi", "Grey"],
    ["Louisiana", "Baton Rouge", "West of Mississippi", "Grey"]
  ],
  "scienceqa_real_022": [
    ["Object", "Material", "Elastic Property", "Property Match"],
    ["rubber band", "Elastic vulcanized polymer", "Stretches under tension and returns to shape", "Stretchy"],
    ["glass marble", "Rigid silicate", "Non-elastic, brittle", "Rigid"],
    ["wooden block", "Solid cellulose fiber", "Non-elastic, rigid", "Hard"]
  ],
  "scienceqa_real_023": [
    ["Organism", "Kingdom", "Cellular Structure", "Multicellular?"],
    ["Rafflesia arnoldii (Corpse flower)", "Plantae (Parasitic flowering plant)", "Trillions of eukaryotic plant cells with differentiated tissues", "Yes (Made up of many cells)"],
    ["Bacterium (e.g. E. coli)", "Bacteria", "Single prokaryotic cell", "No (Unicellular)"]
  ],
  "scienceqa_real_024": [
    ["Parent Alleles", "Allele S (Smooth)", "Allele S (Smooth)"],
    ["Parent 1 (S)", "SS (smooth)", "SS (smooth)"],
    ["Parent 2 (S)", "SS (smooth)", "SS (smooth)"],
    ["Offspring Ratio", "Smooth seeds: 4 / 4", "Wrinkled seeds: 0 / 4 (Expected ratio 4:0 / 100%)"]
  ],
  "scienceqa_real_025": [
    ["Cooper's Test Parameter", "Design Prototype A", "Design Prototype B", "Measured Evaluation"],
    ["Ramps Tested", "Steep angle ramp", "Shallow angle ramp", "Ramp slope comparison"],
    ["Toy Car", "Identical mass car", "Identical mass car", "Controlled entity"],
    ["Target Outcome", "Distance traveled", "Distance traveled", "Which design gives greatest distance traveled"]
  ],
  "scienceqa_real_026": [
    ["Magnet Configuration", "Left Pole", "Right Pole", "Interaction"],
    ["Facing Poles", "North (N)", "North (N)", "Like poles repel each other (Repel)"]
  ],
  "scienceqa_real_027": [
    ["State", "Capital City", "Location", "Marker"],
    ["Connecticut", "Hartford", "Southern New England / Long Island Sound", "Highlighted state with star at Hartford"],
    ["Rhode Island", "Providence", "East border", "Not highlighted"],
    ["New York", "Albany", "West border", "Not highlighted"]
  ],
  "scienceqa_real_028": [
    ["Ocean", "Geographic Bounds", "Highlighted Status", "Rank by Area"],
    ["Indian Ocean", "Bounded by Africa, Asia, Australia, Southern Ocean", "Highlighted in vivid blue/green", "3rd Largest Ocean (70.56M sq km)"],
    ["Atlantic Ocean", "Between Americas and Europe/Africa", "Not highlighted", "2nd Largest Ocean"],
    ["Pacific Ocean", "Between Asia/Australia and Americas", "Not highlighted", "1st Largest Ocean"]
  ],
  "scienceqa_real_029": [
    ["National Park", "Biome / Location", "Biodiversity Characteristic", "Key Description"],
    ["Yasuni National Park", "Amazon Basin, Ecuador", "Extreme megadiversity of plants, amphibians, birds, and insects", "Has many different types of organisms"],
    ["Polar Tundra", "High Arctic", "Low species richness, sparse vegetation", "Few cold-adapted species"]
  ],
  "scienceqa_real_030": [
    ["Object", "Hardness", "Malleability", "Brittleness / Fragility"],
    ["lightbulb glass", "Hard surface", "Non-malleable", "Fragile (breaks easily upon impact)"],
    ["ceramic teacup", "Hard surface", "Non-malleable", "Fragile (breaks easily upon impact)"],
    ["glass ornament", "Hard surface", "Non-malleable", "Fragile (breaks easily upon impact)"],
    ["Common Property", "All rigid", "Not flexible", "All three objects are Fragile"]
  ],
  "scienceqa_real_031": [
    ["Molecule Model", "Atomic Composition", "Chemical Formula", "Identified Substance"],
    ["Model A (Bromine)", "2 reddish-brown Bromine atoms bonded together", "Br2", "bromine (Diatomic halogen molecule)"],
    ["Model B (Water)", "2 Hydrogen, 1 Oxygen", "H2O", "water"],
    ["Model C (Carbon Dioxide)", "1 Carbon, 2 Oxygen", "CO2", "carbon dioxide"]
  ],
  "scienceqa_real_032": [
    ["Organism Candidate", "Genus", "Species Epithet", "Same Species as Pink-backed Pelican (Pelecanus rufescens)?"],
    ["Pelecanus rufescens", "Pelecanus", "rufescens", "Yes (Identical species name)"],
    ["Pelecanus onocrotalus", "Pelecanus", "onocrotalus", "No (Same genus, different species)"],
    ["Phalacrocorax carbo", "Phalacrocorax", "carbo", "No (Different genus and species)"]
  ],
  "scienceqa_real_033": [
    ["State", "Capital City", "Location / Region", "Highlighted Status"],
    ["North Dakota", "Bismarck", "Upper Midwestern / Great Plains state", "Highlighted green with star at Bismarck"],
    ["South Dakota", "Pierre", "South border", "Grey"],
    ["Minnesota", "Saint Paul", "East border", "Grey"]
  ],
  "scienceqa_real_034": [
    ["Experiment Element", "Feeder A (Sunflower)", "Feeder B (Flax)", "Hypothesis Answered"],
    ["Seed Type", "Sunflower seeds", "Flax seeds", "Independent food source variable"],
    ["Metric Counted", "Number of cardinal visits", "Number of cardinal visits", "Do cardinals visit sunflower feeders more often than flax?"]
  ],
  "scienceqa_real_035": [
    ["State", "Capital City", "Location", "Marker Detail"],
    ["Massachusetts", "Boston", "Coastal Massachusetts Bay", "Highlighted in green with red star at Boston"],
    ["New Hampshire", "Concord", "North border", "Grey"],
    ["Connecticut", "Hartford", "South border", "Grey"]
  ],
  "scienceqa_real_036": [
    ["Animal", "Winter Adaptation", "Camouflage Habitat", "Survival Mechanism"],
    ["short-tailed weasel (ermine)", "Coat turns pure white in winter", "Snow-covered subnivean tundra/forest", "Blends into snow to hunt prey and evade predators"],
    ["common hawk-cuckoo", "Brown barred plumage", "Woodland tree branches", "Tree bark camouflage, not snow"]
  ],
  "scienceqa_real_037": [
    ["Organism Candidate", "Scientific Name", "Genus", "Same Genus as Goliath heron (Ardea goliath)?"],
    ["Great blue heron", "Ardea herodias", "Ardea", "Yes (Shares genus Ardea)"],
    ["American kestrel", "Falco sparverius", "Falco", "No (Genus Falco)"],
    ["Bare-throated tiger heron", "Tigrisoma mexicanum", "Tigrisoma", "No (Genus Tigrisoma)"]
  ],
  "scienceqa_real_038": [
    ["Island Nation", "Island Chain / Sea", "Highlighted Marker", "Sovereign Status"],
    ["Saint Lucia", "Windward Islands / Eastern Caribbean Sea", "Highlighted green island with indicator arrow", "Independent Caribbean nation"],
    ["Barbados", "East of Windward Islands", "Not highlighted", "Island nation"],
    ["Dominican Republic", "Greater Antilles / Hispaniola", "Not highlighted", "Larger island nation"]
  ],
  "scienceqa_real_039": [
    ["Magnet Side A", "Facing Pole A", "Facing Pole B", "Magnetic Force Outcome"],
    ["Left Magnet", "South (S)", "North (N)", "Opposite poles attract (Attract)"]
  ],
  "scienceqa_real_040": [
    ["Organism", "Biological Kingdom", "Cellular Nutrition Mode", "Can Make Own Food?"],
    ["Fromia monilis (Tile sea star)", "Animalia (Echinoderm)", "Heterotrophic (Consumes sponges, detritus)", "No (Animal cells lack chloroplasts; cannot photosynthesize)"],
    ["Marine Kelp / Algae", "Chromista / Plantae", "Autotrophic (Photosynthetic)", "Yes"]
  ],
  "scienceqa_real_041": [
    ["Meteorological Observation", "Time Span / Nature", "Weather vs Climate Classification"],
    ["Tambor Beach reading: 84 deg F at 2:00 PM today", "Short-term conditions of the atmosphere at a specific time and place", "Weather (Short-term snapshot)"],
    ["Average annual tropical precipitation 120 inches", "Long-term pattern of weather over 30+ years", "Climate"]
  ],
  "scienceqa_real_042": [
    ["Pacific Nation", "Subregion / Coordinates", "Highlighted Marker", "Geography"],
    ["Nauru", "Micronesia / 0 deg 32' S, 166 deg 55' E", "Highlighted single island circle", "Island country northeast of Solomon Islands"],
    ["Vanuatu", "Melanesia", "South", "Island archipelago"],
    ["Tonga", "Polynesia", "Southeast", "Island archipelago"]
  ],
  "scienceqa_real_043": [
    ["Rhetorical Appeal", "Core Technique", "Ad Element", "Primary Appeal Used"],
    ["pathos (emotion)", "Evokes emotional response (love, protection, fear for child safety)", "Protective parent and vulnerable infant visual & evocative copy", "Primary Appeal: Pathos"],
    ["logos (reason)", "Statistical evidence, logic, mathematical facts", "Data charts, percent efficacy", "Secondary / not primary"],
    ["ethos (character/credibility)", "Celebrity/expert endorsement, moral authority", "Doctor credentials, institute certification", "Secondary / not primary"]
  ],
  "scienceqa_real_044": [
    ["Animal", "Camouflage Appearance", "Habitat Matching", "Dead Leaf Adaptation"],
    ["Surinam horned frog", "Brown, angular body with pointed brow horns and vein-like leaf ridges", "Amazon rainforest floor among fallen leaves", "Highly adapted cryptic leaf camouflage"],
    ["strawberry poison frog", "Bright red body with blue legs", "Rainforest understory", "Aposematic warning coloration, not camouflage"]
  ],
  "scienceqa_real_045": [
    ["Helen's Experiment Setup", "Bucket 1-5 (Condition A)", "Bucket 6-10 (Condition B)", "Dependent Variable / Question Answered"],
    ["Fabric Material", "Linen fabric swatch", "Cotton fabric swatch", "Comparing fabric type absorption"],
    ["Dye Solution & Time", "1 gallon water + black dye, 20 min", "1 gallon water + black dye, 20 min", "Controlled constant"],
    ["Best Question Answered", "-", "-", "Does linen fabric turn darker than cotton fabric when soaked in a mixture of black dye and water?"]
  ],
  "scienceqa_real_046": [
    ["Magnet Pair", "Poles Facing", "Distance Between Poles", "Magnetic Force Strength"],
    ["Pair 1", "North and South", "2.5 inches (Larger distance)", "Weaker magnetic force"],
    ["Pair 2", "North and South", "1.0 inch (Smaller distance)", "Stronger magnetic force (Pair 2 is stronger)"]
  ],
  "scienceqa_real_047": [
    ["US State", "Capital City", "Location / Puget Sound", "Map Indication"],
    ["Washington", "Olympia", "Southern tip of Puget Sound", "Highlighted green state with star at Olympia"],
    ["Seattle", "Largest City (Not capital)", "King County, Puget Sound", "Dot"],
    ["Spokane", "City in Eastern Washington", "Near Idaho border", "Dot"]
  ],
  "scienceqa_real_048": [
    ["Solution Beaker", "Green Solute Particles (Count)", "Solvent Liquid Volume (mL)", "Concentration (Particles / mL)"],
    ["Solution A", "8 particles", "50 mL", "8 / 50 = 0.16 particles/mL"],
    ["Solution B", "16 particles", "100 mL", "16 / 100 = 0.16 particles/mL"],
    ["Comparison", "Different solute amounts", "Proportional volume differences", "Neither; their concentrations are the same (0.16 particles/mL)"]
  ],
  "scienceqa_real_049": [
    ["Naming System", "Nomenclature Example", "Formatting Rule", "Valid Scientific Name"],
    ["Scientific Name (Binomial)", "Argema mittrei", "Two words, Latinized, italicized, capitalized Genus with lowercase species epithet", "Argema mittrei (Scientific name)"],
    ["Common Name", "comet moth (or Madagascan moon moth)", "Standard vernacular English words, not italicized", "comet moth (Common name)"]
  ]
};

// -------------------------------------------------------------
// 3. Process Datasets and Update samples.json files
// -------------------------------------------------------------
console.log("Updating SPIQA samples.json with extracted tables...");
const spiqaJsonPath = path.join(DATA_ROOT, 'spiqa', 'samples.json');
const spiqaData = JSON.parse(fs.readFileSync(spiqaJsonPath, 'utf8'));
spiqaData.forEach(item => {
  if (spiqaTables[item.id]) {
    item.table = spiqaTables[item.id];
  }
});
fs.writeFileSync(spiqaJsonPath, JSON.stringify(spiqaData, null, 2), 'utf8');
console.log(`Updated ${spiqaData.length} SPIQA samples with structured tables.`);

console.log("Updating ScienceQA samples.json with extracted tables...");
const scienceqaJsonPath = path.join(DATA_ROOT, 'scienceqa', 'samples.json');
const scienceqaData = JSON.parse(fs.readFileSync(scienceqaJsonPath, 'utf8'));
scienceqaData.forEach(item => {
  if (scienceqaTables[item.id]) {
    item.table = scienceqaTables[item.id];
  }
});
fs.writeFileSync(scienceqaJsonPath, JSON.stringify(scienceqaData, null, 2), 'utf8');
console.log(`Updated ${scienceqaData.length} ScienceQA samples with structured tables.`);

// Read ChartQA data
const chartqaJsonPath = path.join(DATA_ROOT, 'chartqa', 'samples.json');
const chartqaData = JSON.parse(fs.readFileSync(chartqaJsonPath, 'utf8'));
console.log(`ChartQA has ${chartqaData.length} samples with existing structured tables.`);

// -------------------------------------------------------------
// 4. Export Datasets into Tables (CSV & Markdown)
// -------------------------------------------------------------

function exportDatasetFiles(datasetName, samples) {
  const dir = path.join(DATA_ROOT, datasetName);
  
  // CSV Export
  const csvHeaders = ["id", "title", "type", "question", "answer", "imagePath", "source", "markdownTable", "rawTableJson"];
  const csvRows = [csvHeaders.join(',')];

  samples.forEach(s => {
    const mdTable = formatTableToMarkdown(s.table);
    const row = [
      toCsvCell(s.id),
      toCsvCell(s.title || ''),
      toCsvCell(s.type || (datasetName === 'chartqa' ? 'chart_table' : '')),
      toCsvCell(s.question || ''),
      toCsvCell(s.answer || ''),
      toCsvCell(s.imagePath || ''),
      toCsvCell(s.source || ''),
      toCsvCell(mdTable),
      toCsvCell(s.table || [])
    ];
    csvRows.push(row.join(','));
  });

  const csvPath = path.join(dir, 'dataset_table.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf8');

  // Markdown Export
  let mdContent = `# ${datasetName.toUpperCase()} — Benchmark Dataset Table\n\n`;
  mdContent += `Total samples: **${samples.length}** | Tabular representations converted from benchmark images.\n\n`;
  mdContent += `| ID | Title / Concept | Question | Answer | Extracted Image Table |\n`;
  mdContent += `| :--- | :--- | :--- | :--- | :--- |\n`;

  samples.forEach(s => {
    const compactTitle = (s.title || '').replace(/\|/g, '-');
    const compactQ = (s.question || '').replace(/\|/g, '-');
    const compactA = (s.answer || '').replace(/\|/g, '-');
    const tableSummary = Array.isArray(s.table) && s.table.length > 0
      ? `**${s.table[0].join(' / ')}** (${s.table.length - 1} rows)`
      : '_No table_';

    mdContent += `| \`${s.id}\` | ${compactTitle} | ${compactQ} | **${compactA}** | ${tableSummary} |\n`;
  });

  mdContent += `\n\n## Detailed Extracted Tables per Sample\n\n`;
  samples.forEach(s => {
    mdContent += `### ${s.id}: ${s.title || 'Sample'}\n\n`;
    mdContent += `- **Question**: ${s.question}\n`;
    mdContent += `- **Answer**: ${s.answer}\n`;
    mdContent += `- **Image**: \`${s.imagePath}\`\n\n`;
    mdContent += `**Extracted Tabular Evidence:**\n\n`;
    mdContent += formatTableToMarkdown(s.table) + `\n\n---\n\n`;
  });

  const mdPath = path.join(dir, 'dataset_table.md');
  fs.writeFileSync(mdPath, mdContent, 'utf8');

  console.log(`Generated ${datasetName} CSV: ${csvPath} and Markdown: ${mdPath}`);
}

exportDatasetFiles('chartqa', chartqaData);
exportDatasetFiles('scienceqa', scienceqaData);
exportDatasetFiles('spiqa', spiqaData);

// -------------------------------------------------------------
// 5. Unified Master Benchmark Table (All 120 Samples)
// -------------------------------------------------------------
const allSamples = [
  ...chartqaData.map(s => ({ ...s, dataset: 'chartqa', type: s.type || 'chart_table' })),
  ...scienceqaData.map(s => ({ ...s, dataset: 'scienceqa', type: s.type || 'science_mc' })),
  ...spiqaData.map(s => ({ ...s, dataset: 'spiqa', type: s.type || 'paper_figure' }))
];

// Master CSV
const masterCsvHeaders = ["dataset", "id", "title", "type", "question", "answer", "imagePath", "source", "markdownTable", "rawTableJson"];
const masterCsvRows = [masterCsvHeaders.join(',')];

allSamples.forEach(s => {
  const mdTable = formatTableToMarkdown(s.table);
  const row = [
    toCsvCell(s.dataset),
    toCsvCell(s.id),
    toCsvCell(s.title || ''),
    toCsvCell(s.type || ''),
    toCsvCell(s.question || ''),
    toCsvCell(s.answer || ''),
    toCsvCell(s.imagePath || ''),
    toCsvCell(s.source || ''),
    toCsvCell(mdTable),
    toCsvCell(s.table || [])
  ];
  masterCsvRows.push(row.join(','));
});

const masterCsvPath = path.join(DATA_ROOT, 'all_datasets_table.csv');
fs.writeFileSync(masterCsvPath, masterCsvRows.join('\n'), 'utf8');

// Master JSON
const masterJsonPath = path.join(DATA_ROOT, 'all_datasets_table.json');
fs.writeFileSync(masterJsonPath, JSON.stringify(allSamples, null, 2), 'utf8');

// Master Markdown Report
let masterMd = `# EvidentAI Multimodal Benchmark Datasets (Master Table)\n\n`;
masterMd += `Total benchmark items: **${allSamples.length}** across 3 visual domains:\n`;
masterMd += `- **ChartQA**: 50 items (Charts, plots, and bar/line/pie distributions)\n`;
masterMd += `- **ScienceQA**: 50 items (Scientific diagrams, experiments, biology, physics, maps)\n`;
masterMd += `- **SPIQA**: 20 items (Scientific paper figures, architectures, performance benchmark matrices)\n\n`;
masterMd += `All visual figures have been extracted into grounded 2D tabular formats.\n\n`;

masterMd += `| Dataset | Sample ID | Type | Question Summary | Ground Truth Answer | Extracted Table Schema |\n`;
masterMd += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

allSamples.forEach(s => {
  const tableHeader = (s.table && s.table[0]) ? s.table[0].join(' / ') : 'None';
  masterMd += `| **${s.dataset}** | \`${s.id}\` | \`${s.type}\` | ${s.question.slice(0, 70)}... | ${s.answer.slice(0, 35)} | ${tableHeader} |\n`;
});

const masterMdPath = path.join(DATA_ROOT, 'all_datasets_table.md');
fs.writeFileSync(masterMdPath, masterMd, 'utf8');

console.log(`\nMaster tables generated successfully!`);
console.log(`  - Master CSV: ${masterCsvPath} (${masterCsvRows.length - 1} rows)`);
console.log(`  - Master JSON: ${masterJsonPath}`);
console.log(`  - Master Markdown: ${masterMdPath}`);
