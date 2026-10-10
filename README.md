# ProofLead

ProofLead is a lead enrichment and scoring tool designed for Private Equity (PE) sourcing. It aggregates hiring and technology signals to identify growth and acquisition-readiness in software companies.

## Why this fits Caprae
ProofLead aligns perfectly with Caprae Capital's PE sourcing strategy. By analyzing a company's open engineering roles and the underlying tech stack (ATS signals), ProofLead surfaces strong leading indicators of growth and acquisition-readiness (e.g., expanding engineering headcount, adoption of enterprise tech stacks).

## Architecture
- **Monolithic Express serving React/Vite:** The backend Express server handles API requests while concurrently serving the production build of the React/Vite frontend.
- **Database (SQLite leads.db):** Uses a local SQLite database (`leads.db`) for lightweight, serverless data storage.
- **Caching:** API responses from the LLM and ATS are aggressively cached in the SQLite database to prevent redundant requests and API rate limits.
- **Daily and Per-IP caps:** Enforces strict daily (`DAILY_LIVE_CAP`) and per-IP (`PER_IP_LIVE_CAP`) limits on live enrichments. Once reached, the app falls back to cached SQLite data.
- **LLM:** Uses Groq's `openai/gpt-oss-120b` for high-speed, cost-effective inference on job descriptions and website text.
- **Render & Deploy Process:** Built to deploy as a single Web Service on Render. The `build` script compiles the frontend, and the `start` script boots the monolithic Express server.

## Limitations & Ethical Data Collection
- Hiring and tech signals come only from Greenhouse/Lever/Ashby; companies without a detectable public ATS (e.g. Loom, acquired by Atlassian) show 'Not found'.
- **Ephemeral disk tradeoff on Render free tier:** Because the Render free tier uses ephemeral storage, the SQLite database (`leads.db`) is reset on every deployment or server restart. A seed file (`leads.json`) is used to populate initial data on boot.

## Setup & Run Instructions
### Prerequisites
- Node.js (v20.x)
- NPM

### Local Setup
1. Clone the repository.
2. Run `npm run install:all` to install both backend and frontend dependencies.
3. Set your `.env` variables (e.g., `GROQ_API_KEY`).
4. Run `npm run build` to compile the frontend.
5. Run `npm start` to boot the application.

### Render Deployment
Set the build command to `npm run build` and the start command to `npm start`. Configure your environment variables in the Render dashboard.

