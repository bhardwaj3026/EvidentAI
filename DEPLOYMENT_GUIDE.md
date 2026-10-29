# EvidentAI Production Deployment Guide

This guide contains everything you need to deploy **EvidentAI** to production on any cloud platform (**Render**, **Railway**, **Vercel**, **AWS**, or **Docker**).

Whenever you are ready to deploy, open this project and I (your AI pair programmer) will guide you through each step!

---

## 1. Environment Variables Checklist

Whenever you set up a new deployment, copy these variables from your local [`.env`](file:///.env) file into your cloud platform's **Environment Variables** dashboard:

| Variable Name | Value / Description | Required? |
| :--- | :--- | :--- |
| `PORT` | `8080` (or leave default if platform auto-assigns `$PORT`) | Recommended |
| `GEMINI_API_KEY` | `your_gemini_api_key_here` (from Google AI Studio) | **Yes** |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | **Yes** |
| `MONGODB_URI` | `mongodb+srv://<username>:<password>@cluster.mongodb.net/evidentai` | **Yes (Cloud DB)** |
| `ANTHROPIC_API_KEY` | *(Optional, leave empty unless using Claude)* | Optional |
| `OPENAI_API_KEY` | *(Optional, leave empty unless using GPT-4)* | Optional |

---

## 2. Deploying to Render (Recommended - Easiest & Free)

1. Push your repository to **GitHub**.
2. Go to **[render.com](https://render.com)** and sign in.
3. Click **New +** &rarr; **Web Service**.
4. Connect your `EvidentAI` repository.
5. Configure the service:
   - **Name**: `evident-ai`
   - **Environment**: `Node`
   - **Region**: Choose closest to you (e.g. `Singapore` or `Frankfurt`)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
6. Scroll down to **Environment Variables** and add:
   - `GEMINI_API_KEY` = your Gemini API key from `.env`
   - `GEMINI_MODEL` = `gemini-3.1-flash-lite`
   - `MONGODB_URI` = your MongoDB Atlas connection string from `.env`
7. Click **Create Web Service**.
8. In 2 minutes, Render will provide your live public URL (e.g., `https://evident-ai.onrender.com`).

---

## 3. Deploying to Railway

1. Go to **[railway.app](https://railway.app)**.
2. Click **New Project** &rarr; **Deploy from GitHub repo**.
3. Select this repository.
4. In **Settings**:
   - Start Command: `npm start`
5. In **Variables**, add:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`
   - `MONGODB_URI`
6. Under **Networking**, click **Generate Domain** to get your public URL.

---

## 4. Deploying to AWS EC2 / DigitalOcean Ubuntu VPS

1. SSH into your Ubuntu server:
   ```bash
   ssh ubuntu@your-server-ip
   ```
2. Install Node.js (v20+ or v22+):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   ```
3. Clone your repository:
   ```bash
   git clone https://github.com/bhardwaj3026/EvidentAI.git
   cd EvidentAI
   npm install
   ```
4. Create `.env` file:
   ```bash
   nano .env
   # Add your GEMINI_API_KEY, GEMINI_MODEL, and MONGODB_URI
   ```
5. Install PM2 process manager to run 24/7 with auto-restart on reboot:
   ```bash
   sudo npm install -g pm2
   pm2 start server.js --name "evident-ai"
   pm2 startup
   pm2 save
   ```

---

## 5. Deploying with Docker

If deploying on AWS ECS, Google Cloud Run, or Docker:

**Build and Run**:
```bash
docker build -t evident-ai .
docker run -d -p 8080:8080 \
  -e GEMINI_API_KEY="your_gemini_api_key_here" \
  -e GEMINI_MODEL="gemini-3.1-flash-lite" \
  -e MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/evidentai" \
  evident-ai
```

---

## 6. Verification Checklist After Deployment

After deploying to any platform, verify these 4 tests:
1. **Homepage Loads**: Visit your public URL &rarr; confirms frontend serves properly.
2. **Strict Verification Toggle**: Verify it defaults to **OFF**.
3. **Model Branding**: Send a message &rarr; verify the response footer shows `EvidentAI · Xs`.
4. **Chat History & MongoDB**: Open sidebar &rarr; verify your saved chats appear and switch smoothly.

---

*Whenever you are ready to deploy, just ping me with: "I want to deploy to [Platform]" and I will guide you through every click!*
