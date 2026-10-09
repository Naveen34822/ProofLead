# ProofLead

A premium, AI-powered lead scoring and enrichment tool built for high-performance sales teams. 

Instead of just giving sales reps a list of 500 random companies, ProofLead enriches leads with deep data signals, scores them against your Ideal Customer Profile (ICP), and provides actionable insights on *why* a lead is worth calling and *how* to approach them.

## 🌟 Key Features

1. **ICP Definition (Step 1)**: Define your Ideal Customer Profile (Industry, Size, Location, Tech Stack) to establish the baseline for scoring.
2. **Flexible Lead Ingestion (Step 2)**: Upload CSVs, paste domains, or use the built-in sample dataset (30 real SaaS companies) for a flawless demo.
3. **Data Enrichment**: (Simulated for demo reliability) Extracts firmographics, tech stack, and crucial growth/hiring signals.
4. **Smart Lead Scoring**: 
   - 0-100 score based on 5 weighted factors (Industry Match, Company Size, Location, Growth Signals, Tech Match).
   - Fully transparent scoring with a visual breakdown.
   - **Signal Coverage Caps**: To prevent falsely high scores on sparse data, scores are capped based on how many signals are successfully extracted:
     - 1 valid signal = Max Score 40
     - 2 valid signals = Max Score 65
     - 3-5 valid signals = Max Score 100
     - *Note: Tech matches only count positively for technologies explicitly selected in the ICP.*
5. **Actionable Insights ("Why This Lead?")**: Automatically generates a clear explanation of why a lead is a good fit and how to approach them.
6. **Premium Dashboard (Step 3)**: A sleek, dark-mode UI with sorting, filtering, deduplication, and a rich detail panel.
7. **CSV Export**: Instantly export the prioritized list for the sales team.

## 📊 Scoring Formula & Coverage Cap

The Lead Scoring Engine dynamically assigns a priority score (0-100) based on how well a company matches your Ideal Customer Profile (ICP).

### The Weights
- **Industry Match (30%)**: Uses categorical mapping (e.g., "Developer Platform" translates to "DevTools"). Strict string matching is bypassed to handle real-world variations.
- **Company Size (20%)**: Scaled linearly. If the target is 50-200 and a company is 500, they receive a proportionally lower score rather than a simple pass/fail.
- **Location (20%)**: Checks if the extracted HQ matches target cities or countries.
- **Hiring Signals (20%)**: Directly checks ATS boards (Greenhouse, Lever, Ashby) to mathematically prove the company is hiring.
- **Tech Stack (10%)**: The more matched technologies, the higher the score.

### Dynamic Normalization & Coverage Cap
The LLM may return `unknown` for fields it cannot verify with an exact quote. Instead of heavily penalizing a lead simply because the website is sparse, the scoring engine renormalizes the available weights. For example, if size is unknown, the score is calculated purely from Industry, Location, Hiring, and Tech.

To prevent sparse leads from falsely appearing as "High Priority", a **Coverage Cap** is applied based on the number of verified signals:
- **1 Known Signal**: Score is strictly capped at **40**.
- **2 Known Signals**: Score is strictly capped at **65**.
- **3+ Known Signals**: Can reach **100**.

*Note: To be flagged as a "High Priority" lead (Score 75+), the company must have at least 3 verified signals and a Medium/High confidence rating.*


## 🛠️ Tech Stack

- **Frontend**: React (Vite)
- **Styling**: Vanilla CSS (Custom Design System, Glassmorphism, Dark Mode)
- **Data Parsing**: PapaParse (CSV)
- **Icons/Typography**: Inter & JetBrains Mono (Google Fonts)

## 🚀 Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

## 💡 The "Actionable Insight" Differentiator

Most tools stop at data collection. ProofLead bridges the gap between data and action. By combining firmographic data with growth signals (like "actively hiring 42 roles" or "recent funding"), it tells the sales rep exactly *why* a company is a hot lead and provides an *Outreach Suggestion* tailored to that specific company's current state.

## 🧠 LLM Models

ProofLead uses the Groq API for rapid enrichment.
- **Primary Model**: `openai/gpt-oss-120b` (via `process.env.GROQ_MODEL`)
- **Fallback Model**: `openai/gpt-oss-20b` (for rate limits or JSON parse errors)
