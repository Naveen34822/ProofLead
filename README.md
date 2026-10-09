# ProofLead

ProofLead is an intelligent B2B Lead Scoring and Enrichment tool designed specifically for Private Equity sourcing and sales teams. It automatically scrapes target websites and job boards to detect growth signals, technology stacks, and ideal customer profile (ICP) fits.

	## Why ProofLead? (Caprae Capital)
For PE sourcing, growth signals are key indicators of a company's acquisition readiness. We specifically look at:
- **Hiring Signals**: Companies actively hiring for engineering, product, or data roles are investing in product growth.
- **Technology Stack**: Automatically reverse-engineering a company's tech stack by parsing their applicant tracking system (ATS) reveals their technical maturity without needing a technical discovery call.
ProofLead automates these exact lookups, making it an essential tool for evaluating Caprae's targets.

## Architecture
ProofLead is built as a single monolithic service optimized for quick deployment and low costs:
- **Backend**: Node.js Express service acting as both the API server and static file host.
- **Frontend**: React (Vite) single-page application built into `frontend/dist` and served by Express.
- **Database (SQLite)**: Uses `better-sqlite3` with `leads.db` for caching and tracking usage. 
- **LLM Engine**: Powered by Groq (`openai/gpt-oss-120b`) for lightning-fast text extraction and inference.
- **Hosting**: Designed to be deployed on Render's Web Service (Free tier compatible).

	### Caching Strategy & Cost Management
To manage LLM API costs and mitigate the Render free tier's ephemeral filesystem:
- **Daily Global Caps**: Enforced by a `daily_stats` SQLite table. Stops live LLM queries after a certain threshold.
- **Per-IP Rate Limitq**: Prevents individual users from exhausting the API quota.
- **Ephemeral Auto-seeding**: Since Render wipes the local `leads.db` filesystem on every deploy, the app automatically detects an empty database on startup and seeds it from `backend/seed/leads.json`. This ensures reviewers always have a rich dataset to interact with.

## Limitations & Ethical Data Collection
- **Public Data Only**: ProofLead strictly relies on public website data and respects `robots.txt`. No personal data (PII) is scraped or stored.
- **Job Board Constraints**: ATS signals (Tech stack & Hiring) are only extracted if the company uses Greenhouse, Lever, or AshbyHQ. Companies using proprietary boards or hidden pages (like Loom after their Atlassian acquisition) will gracefully degrade to "Not found".
- **Headless Browser Constraints**: To run efficiently on Render without huge memory overhead, Puppeteer rendering is disabled in production. HighlyJS-dependent websites may yield thin extraction results.

## Setup & Run Instructions

### Prerequisites
- Node.js (v20.x recommended)
- A Groq API Key

### Local Setup
1. Install all dependencies from the root directory:
   ``bash
   npm run install:all
   ```
2. Build the frontend application:
   ``bash
   npm run build
   ```
3. Set up environment variables. Create a `.env` file in the root directory:
   ```env
   GROQ_API_KEY=your_key_here
   GROQ_MODEL=openai/gpt-oss-120b
   PUPPETEER_ENABLED=true
   DAILY_LIVE_CAP=25
   PER_IP_LIVE_CAP=5
   PORT=3001
   ```
4. Start the monolithic server:
   ```bash
   npm start
   ```
   Navigate to `http://localhost:3001`.

### Render Deployment
Deploy as a **Web Service** on Render with the following configuration:
- **Build Command**: `npm run install:all && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `NODE_ENV=production`
  - `GROQ_API_KEY=your_key`
  - `GROQ_MODEL=openai/gpt-oss-120b`
  - `PUPPETEER_ENABLED=false` (To save memory)
  - `DAILY_LIVE_CAP=25`
  - `PER_IP_LIVE_CAP=5`
