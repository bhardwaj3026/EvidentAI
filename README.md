# Multimodal AI Image Chat

A fast, intuitive, ChatGPT-style conversational assistant for multimodal visual question answering, evidence grounding, and on-demand hallucination verification.

---

## 🌟 Key Features

- **Continuous Multimodal Q&A**: Upload photos, charts, screenshots, or scientific figures and ask questions across multiple conversational turns without having to re-upload.
- **Strict Evidence Grounding Mode**: Toggle the **Strict Evidence** switch to enforce that the assistant derives answers strictly from visible details in the attached image, preventing speculative reasoning.
- **On-Demand Hallucination Checking**: Click **"🔍 Check for hallucinations"** under any assistant response to run an automated RAGTruth claim verification pass that classifies claims as `Supported`, `Subtle Conflict`, `Evident Conflict`, or `Baseless`.
- **Speech & Audio Integration**:
  - **Voice Dictation (Web Speech API)**: Click 🎙️ in the composer to speak your question with live animated audio soundwaves.
  - **Read Aloud TTS (Web Speech Synthesis)**: Click 🔊 under any assistant message to listen to the explanation.
- **Multi-Account Quota & History**:
  - Pre-configured demo accounts (**Alice** & **Bob**) with isolated conversation histories and a 10-chat quota tracker.
  - Reset quota or switch accounts with 1-click in the user account dropdown.
  - Conversation history drawer (`💬 History`) with persistent chat sessions.
- **Dark & Light Theme**: Seamless toggle between warm paper and sleek dark mode (`🌙`/`☀️`).

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- Modern Chromium, Firefox, or WebKit browser

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration (`.env`)
Create a `.env` file in the root directory (or copy from `.env.example`):

```bash
cp .env.example .env
```

Add your preferred multimodal LLM provider credentials:

```env
PORT=8080

# Google Gemini API Key (Server-side)
GEMINI_API_KEY=your_gemini_api_key_here

# Anthropic Claude API Key (Optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# OpenAI API Key (Optional)
OPENAI_API_KEY=your_openai_api_key_here
```

> **Zero-Config Heuristic Mode**: If API keys are omitted or rate-limited, the application runs automatically in zero-config heuristic mode, allowing you to test image uploads, chat interactions, and hallucination checks immediately out of the box!

### 4. Run Locally
```bash
npm start
```

Open your browser to:
- [http://localhost:8080/](http://localhost:8080/)

---

## 📁 Repository Structure

```
capstone real/
├── chat.html             # Dedicated Multimodal Image Chat interface
├── index.html            # Symlink / mirror of chat.html for root loading
├── chat.css              # Custom design system (tokens, dark/light themes, bubbles)
├── chat.js               # Client controller (voice dictation, TTS, image upload, auth)
├── server.js             # Express API server (multimodal routes, chat, check-hallucination)
├── package.json          # Node.js project manifest & scripts
├── .env.example          # Template environment variable configuration
└── data/
    └── users.json        # User accounts, authentication, & quota store
```
