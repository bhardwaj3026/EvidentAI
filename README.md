# EvidentAI — Explainable & Verifiable Multimodal AI

A fast, intuitive, and verifiable multimodal AI assistant designed for visual question answering, evidence grounding, and on-demand hallucination detection. Powered by Google Gemini and equipped with automated claim inspection.

---

## 🌟 Key Features

- **Continuous Multimodal Q&A**: Upload photos, charts, screenshots, diagrams, PDFs, or Word documents and engage in multi-turn conversation without losing visual or chat context.
- **Strict Verification Mode**: One-click toggle requiring the model to rely strictly on observable evidence from the provided visual input, suppressing speculative extrapolation.
- **On-Demand Hallucination Verification**: Run an automated claim verification pass under any assistant response that breaks answers down into claims and audits grounding against the source evidence (`Supported`, `Subtle Conflict`, `Evident Conflict`, `Baseless`).
- **Cloud Database Sync (MongoDB Atlas)**: Automatically synchronizes user accounts, quotas, and conversation history to MongoDB Atlas with seamless offline local JSON fallback.
- **Speech & Audio Integration**:
  - **Voice Dictation (Web Speech API)**: Dictate prompts hands-free with animated real-time soundwaves.
  - **Read Aloud TTS (Web Speech Synthesis)**: Audio playback of responses directly in-browser.
- **Tiered Multi-Account Management**: Built-in account tiers (**Ultra Pro**, **Pro**, **Plus**, and **Starter**) with quota tracking and instantaneous account switching.
- **Obsidian Dark & Clean Light Themes**: Full dark/light theme toggle supporting smooth transitions across the entire chat UI.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- Modern Chromium, Firefox, or Safari browser

### 2. Installation
```bash
git clone https://github.com/bhardwaj3026/EvidentAI.git
cd EvidentAI
npm install
```

### 3. Environment Configuration (`.env`)
Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Add your environment variables:

```env
PORT=8080

# Google Gemini API Key (Get free at https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite

# Optional Cloud Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/evidentai
```

### 4. Run Locally
```bash
npm start
```

Open your browser to:
- [http://localhost:8080/](http://localhost:8080/)

---

## 📁 Repository Structure

```
EvidentAI/
├── chat.html             # EvidentAI Image Chat Interface
├── index.html            # Main entry point (mirrors chat.html)
├── chat.css              # Custom design system with Obsidian dark & light themes
├── chat.js               # Client controller (voice, multi-turn state, auth, rendering)
├── server.js             # Express API entry point
├── DEPLOYMENT_GUIDE.md   # Step-by-step production deployment guide
├── server/
│   ├── chat.js           # Multi-turn chat routing & history API
│   ├── detection.js      # Hallucination detection pipeline & claim auditing
│   ├── userStore.js      # MongoDB Atlas & local JSON dual-persistence engine
│   └── llm/provider.js   # Multimodal LLM providers (Gemini, Claude, OpenAI)
├── data/
│   └── users.json        # Local storage fallback for users and sessions
├── package.json          # Node dependencies & start scripts
└── .env.example          # Environment template
```

---

## 🌐 Production Deployment

For complete instructions on deploying EvidentAI to **Render**, **Railway**, **AWS**, or **Vercel** with MongoDB Atlas, refer to [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

---

## 📄 License
MIT License
