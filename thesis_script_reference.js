/**
 * CAPSTONE RESEARCH SHOWCASE - INTERACTIVE CONTROLLER
 * Project: Quantifying and Mitigating Hallucinations in Multimodal RAG
 */

document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle();
  initNavigationHighlighting();
  initTaxonomyInteractivity();
  initPipelineInspector();
  initCitationModal();
});

/* --------------------------------------------------------------------------
   1. THEME TOGGLE (Light / Dark Mode)
   -------------------------------------------------------------------------- */
function initThemeToggle() {
  const themeBtn = document.getElementById("theme-toggle-btn");
  const themeIcon = document.getElementById("theme-toggle-icon");
  const themeLabel = document.getElementById("theme-toggle-label");

  // Check saved theme or system preference
  const savedTheme = localStorage.getItem("capstone_theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  
  let currentTheme = savedTheme || (prefersDark ? "dark" : "light");
  applyTheme(currentTheme);

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      currentTheme = currentTheme === "light" ? "dark" : "light";
      applyTheme(currentTheme);
      localStorage.setItem("capstone_theme", currentTheme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeIcon && themeLabel) {
      if (theme === "dark") {
        themeIcon.textContent = "☀️";
        themeLabel.textContent = "Light Paper";
      } else {
        themeIcon.textContent = "🌙";
        themeLabel.textContent = "Dark Slate";
      }
    }
  }
}

/* --------------------------------------------------------------------------
   2. ACTIVE NAVIGATION HIGHLIGHTING (Intersection Observer)
   -------------------------------------------------------------------------- */
function initNavigationHighlighting() {
  const sections = document.querySelectorAll("section[id]");
  const navLinks = document.querySelectorAll(".nav-links a");

  if (!sections.length || !navLinks.length) return;

  const observerOptions = {
    root: null,
    rootMargin: "-20% 0px -70% 0px",
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          if (link.getAttribute("href") === `#${id}`) {
            link.classList.add("active");
          } else {
            link.classList.remove("active");
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach((section) => observer.observe(section));
}

/* --------------------------------------------------------------------------
   3. TAXONOMY INTERACTIVITY & CASE STUDY DRAWERS
   -------------------------------------------------------------------------- */
function initTaxonomyInteractivity() {
  const toggleButtons = document.querySelectorAll(".taxonomy-example-btn");

  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = btn.getAttribute("data-target");
      const drawer = document.getElementById(targetId);
      
      if (drawer) {
        const isOpen = drawer.classList.contains("open");
        
        // Close all other drawers for clean reading
        document.querySelectorAll(".taxonomy-example-box").forEach((box) => box.classList.remove("open"));
        document.querySelectorAll(".taxonomy-example-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));

        if (!isOpen) {
          drawer.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      }
    });
  });
}

/* --------------------------------------------------------------------------
   4. 8-STAGE PIPELINE INSPECTOR
   -------------------------------------------------------------------------- */
const PIPELINE_STAGE_DATA = {
  "stage-1": {
    number: "01",
    title: "Question Formulation",
    type: "Input Processing",
    input: "User query (Natural language + question context)",
    output: "Structured query representation with intent breakdown",
    details: "Parses the incoming question to identify multimodal requirements: textual query intent, referenced figures/tables, and expected reasoning depth (e.g., direct lookup vs. multi-step visual arithmetic)."
  },
  "stage-2": {
    number: "02",
    title: "Multimodal Retrieval",
    type: "Dense & Sparse Vector Search",
    input: "Structured query & document indices",
    output: "Top-k retrieved textual chunks, crop regions, tables, & chart metadata",
    details: "Executes hybrid retrieval across text passages, diagram OCR snippets, chart raw values, and visual embeddings using dense cross-modal encoders. Retrieves supporting context across ScienceQA, ChartQA, or SPIQA sources."
  },
  "stage-3": {
    number: "03",
    title: "Evidence Construction",
    type: "Context Assembly",
    input: "Heterogeneous retrieved evidence fragments",
    output: "Unified cross-modal prompt context",
    details: "Formats retrieved text alongside image patches, table Markdown representations, and visual layout bounding boxes into a cohesive prompt context suitable for Multimodal LLM ingestion."
  },
  "stage-4": {
    number: "04",
    title: "Generation",
    type: "MLLM Synthesis",
    input: "Multimodal prompt context & question",
    output: "Candidate answer & chain-of-thought rationale",
    details: "The vision-language model generates a step-by-step rationale followed by the candidate answer. The system captures intermediate token probabilities for downstream confidence estimation."
  },
  "stage-5": {
    number: "05",
    title: "Hallucination Detection",
    type: "Automated Verification",
    input: "Generated rationale, candidate answer, & retrieved evidence",
    output: "Hallucination indicator & detailed verification flags",
    details: "Applies automated hallucination detection metrics adapted from POPE, Ragas, RAGTruth, and SelfCheckGPT to verify whether every generated claim is faithful to the retrieved evidence."
  },
  "stage-6": {
    number: "06",
    title: "Quantification",
    type: "Taxonomy & Metric Scoring",
    input: "Verification flags & reasoning trace",
    output: "Taxonomy error classification (Types 1–5) & numerical score",
    details: "Differentiates grounded-process errors (Retrieval, Reasoning, Generation, Grounding) from true Hallucinations (Type 5). Computes item-level and benchmark-level hallucination rates."
  },
  "stage-7": {
    number: "07",
    title: "Mitigation",
    type: "Refinement & Self-Correction",
    input: "Flagged error type & unfaithful claims",
    output: "Re-grounded context or corrected rationale constraint",
    details: "Triggers targeted feedback loops: re-retrieving missing visual regions for Grounding Errors or forcing constrained self-consistency checks for Reasoning Errors."
  },
  "stage-8": {
    number: "08",
    title: "Final Answer & Evaluation",
    type: "Output Verification",
    input: "Mitigated rationale & final answer",
    output: "Verified output & benchmark performance log",
    details: "Outputs the final answer along with its quantified faithfulness score and logs detailed metrics across ScienceQA, ChartQA, and SPIQA benchmarks."
  }
};

function initPipelineInspector() {
  const stageNodes = document.querySelectorAll(".stage-node");
  const inspectorBox = document.getElementById("pipeline-inspector");
  const titleEl = document.getElementById("inspector-title");
  const tagEl = document.getElementById("inspector-tag");
  const inputEl = document.getElementById("inspector-input");
  const outputEl = document.getElementById("inspector-output");
  const descEl = document.getElementById("inspector-desc");
  const closeBtn = document.getElementById("inspector-close");

  if (!stageNodes.length || !inspectorBox) return;

  stageNodes.forEach((node) => {
    node.addEventListener("click", () => {
      const stageKey = node.getAttribute("data-stage");
      const data = PIPELINE_STAGE_DATA[stageKey];

      if (data) {
        // Active state formatting
        stageNodes.forEach((n) => n.classList.remove("active"));
        node.classList.add("active");

        titleEl.textContent = `Stage ${data.number}: ${data.title}`;
        tagEl.textContent = data.type;
        inputEl.textContent = data.input;
        outputEl.textContent = data.output;
        descEl.textContent = data.details;

        inspectorBox.classList.add("open");
        inspectorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      inspectorBox.classList.remove("open");
      stageNodes.forEach((n) => n.classList.remove("active"));
    });
  }
}

/* --------------------------------------------------------------------------
   5. CITATION & BIBTEX HELPER
   -------------------------------------------------------------------------- */
function initCitationModal() {
  const openBtn = document.getElementById("cite-btn");
  const modal = document.getElementById("citation-modal");
  const closeBtn = document.getElementById("close-citation-btn");
  const copyBtn = document.getElementById("copy-bibtex-btn");
  const bibtexPre = document.getElementById("bibtex-text");

  if (openBtn && modal) {
    openBtn.addEventListener("click", (e) => {
      e.preventDefault();
      modal.classList.add("open");
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.remove("open");
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("open");
      }
    });
  }

  if (copyBtn && bibtexPre) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(bibtexPre.textContent).then(() => {
        const origText = copyBtn.textContent;
        copyBtn.textContent = "Copied to Clipboard!";
        setTimeout(() => {
          copyBtn.textContent = origText;
        }, 2000);
      });
    });
  }
}

/* Helper for Print trigger */
function printPage() {
  window.print();
}
