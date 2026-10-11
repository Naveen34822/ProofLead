# ProofLead

**Live Demo:** https://prooflead.onrender.com

> **Assignment note:** ProofLead was built as my submission for Caprae Capital's AI-Readiness Pre-Screening Challenge (Full Stack Developer interview pre-work). It is a time-boxed assignment prototype, not a production product, and it is not affiliated with SaaSquatch. It works only with publicly available company information.
>
> The live demo runs on a free instance, so the first request can take up to a minute to wake up.

ProofLead is an evidence-backed lead qualification and ICP scoring platform built for Private Equity (PE) and M&A searchers. It extracts verified hiring and technology signals directly from public company websites and Applicant Tracking Systems (ATS) to identify growth and acquisition readiness.

---

## Reference App Analysis (SaaSquatch)

SaaSquatch is Caprae's lead-generation platform for entrepreneurs and searchers. Its public feature set covers company discovery (by country, city, industry), employee count and revenue estimates, owner information, contact enrichment, AI company scoring, filters, CSV/Excel export, AI email generation, and validators.

- **Strength:** It discovers a high volume of leads rapidly across broad verticals.
- **The Gap ProofLead Targets:** A long lead list does not tell a user which leads to trust or contact first, and an unanchored AI score gives no way to check where a value came from.
- **What ProofLead Builds (Quality First):** ProofLead takes a list of companies you already have and qualifies it. Every enriched field carries the exact evidence it came from, and any field that cannot be verified stays unknown instead of being guessed. It then scores each company against the user's ICP and explains the score.
- **What ProofLead Does Not Do (By Design):** It does not discover new leads, and it does not return contact details or revenue estimates. It complements a discovery tool rather than replacing it.

---

## UX Design Choices

- **Three-Step Flow:** Define ICP, Add Companies, View Results. Users always know where they are.
- **Evidence Panel:** Clicking a lead opens a drawer with each field, its source (website page, page title/meta, ATS, or CSV) and the supporting quote. This is how a user verifies a lead without leaving the app.
- **Honest Empty States:** "Not found" (no detectable job board) is shown differently from "Not hiring" (job board found, zero roles). Unknown stays unknown.
- **Signal Count:** Each score shows how many signals it is based on (for example 3 of 4), so a score built on little data is visible as such. The denominator changes with the ICP (location counts only if the user set one).
- **Confidence and Filters:** Filter by score, status, industry, confidence, and hiring, and hide leads with missing data.
- **Live Budget Indicator:** The header shows how many live enrichments remain today.
- **Workflow Fit:** CSV in, CSV out, with evidence and the suggested outreach angle included in the export.
- **Sample Dataset:** One click loads cached companies so the tool can be tried without spending any budget.

---

## Architecture

ProofLead is built as a single monolithic service optimized for low latency, predictable costs, and verifiable data pipelines.

### System Architecture
```mermaid
graph TD
    Client["React / Vite Frontend (SPA)"]
    Server["Monolithic Node.js / Express Server (Port 3001)"]
    SQLite[("SQLite DB (leads.db & daily_stats)")]
    Crawl["Web Crawler (Axios + Cheerio)"]
    ATS["ATS APIs (Greenhouse, Lever, Ashby)"]
    LLM["Groq API (openai/gpt-oss-120b)"]

    Client -->|"API Requests: /api/enrich, /api/budget"| Server
    Server -->|"Serves static build (frontend/dist)"| Client
    Server -->|"1. Check Cache (leads.db)"| SQLite
    Server -->|"2. Check Daily Cap (daily_stats)"| SQLite
    Server -->|"3. Crawl Home, About, Careers"| Crawl
    Server -->|"4. Query Job Boards"| ATS
    Server -->|"5. Unstructured Extraction"| LLM
    Server -->|"6. Store Verified Data & Increment Cap"| SQLite
```

### Qualification Workflow
```mermaid
flowchart TD
    Start["User Submits Domain / CSV"] --> CacheCheck{"1. Domain in SQLite Cache (leads.db)?"}
    CacheCheck -- "Yes (textLength at least 500, not forceRefresh)" --> ReturnCache["Return Cached Data (instant response, no LLM call)"]
    
    CacheCheck -- "No / forceRefresh" --> CapCheck{"2. Global Daily Cap or IP Rate Limit Exceeded?"}
    CapCheck -- Exceeded --> FallbackCheck{"Previous Good Cache Exists?"}
    FallbackCheck -- Yes --> ReturnStale["Return Cache with Cap Warning (HTTP 200)"]
    FallbackCheck -- No --> Return429["Return Rate Limit Error (HTTP 429)"]
    
    CapCheck -- Under Cap --> RobotsCheck{"Robots.txt Allowed?"}
    RobotsCheck -- Disallowed --> BlockedStatus["Mark as Blocked (HTTP 403 reason, no LLM call)"]
    
    RobotsCheck -- Allowed --> FetchPages["3. Fetch Pages (Home, About, Careers with 429 Backoff)"]
    FetchPages -- "Site blocked after retries (HTTP 429/403)" --> BlockedFetch["Mark as Blocked (budget not used)"]
    
    FetchPages -- "Pages fetched" --> ATSCheck{"Public ATS Detected (Greenhouse/Lever/Ashby)?"}
    ATSCheck -- Yes --> ATSQuery["Query Public ATS API & Whitelist Tech Stack"]
    ATSCheck -- No --> ATSNone["ATS Status: Not found"]
    
    FetchPages -- "Pages fetched" --> MetaExtract["Extract page title & meta/og:description from Raw HTML"]
    MetaExtract --> LLMCall["4. Groq LLM Extraction (openai/gpt-oss-120b)"]
    
    LLMCall --> VerifyEvidence{"5. Verbatim Evidence Verifier against Page Text & Title/Meta?"}
    VerifyEvidence -- Match Found --> KeepVerified["Keep Field & Verbatim Evidence"]
    VerifyEvidence -- Match Failed --> SetUnknown["Field & Evidence strictly set to unknown"]
    
    KeepVerified --> SaveRecord["6. Save Record to leads.db & Increment daily_stats"]
    SetUnknown --> SaveRecord
    
    SaveRecord --> ClientScoring["7. Client-Side ICP Scoring & Ranking (scoringEngine.js)"]
    ReturnCache --> ClientScoring
```

---

## Performance, Caching and Reliability

- **SQLite Cache (`leads.db`):** One record per domain. A cached domain is returned immediately with instant response, no LLM call.
- **Cost Control:** A daily cap (`DAILY_LIVE_CAP`) tracked in a small SQLite `daily_stats` table (increments only when a live enrichment completes successfully with textLength >= 500) and a per-IP cap (`PER_IP_LIVE_CAP`) where only live enrichments count toward it (cache hits do not), enforced in memory per IP, resets on restart.
- **Resilience:** Automatic retry with backoff when a site returns HTTP 429 (delays of 2000ms and 4000ms or `Retry-After` header), a clear "blocked" status when retries fail, and `robots.txt` is respected.
- **Data Quality:** LLM quotes are checked against the fetched page text (including `<title>` and meta description taken from the raw HTML). Script, style, and hidden elements are removed before text extraction.
- **Tech-Stack Accuracy:** Technologies are counted at most once per role, using word-boundary matching and an alias map (for example postgres and postgresql become one entry). Ambiguous names such as "Go" require a case-sensitive match, and repeated company-intro paragraphs are stripped so they do not inflate counts. Counts are shown as "TypeScript (14/37 roles)" against the engineering, product, and data roles only.
- **Automated Tests:** `npm test --prefix backend` runs the evidence verifier test suite.

---

## Limitations

- **Input Scope:** Input is a CSV of companies; the tool does not discover leads.
- **Contact & Financial Data:** It returns no email, phone, or revenue data.
- **ATS Coverage:** Hiring and tech signals come only from Greenhouse, Lever, and Ashby. Companies without a detectable public job board (for example Loom, acquired by Atlassian) show "Not found". Small job boards give thin tech signals because they rest on few roles.
- **Vertical Suitability:** These signals suit tech and SaaS companies; they say little about traditional small businesses.
- **JavaScript-Rendered Homepages:** Some sites render their homepage with JavaScript (for example Notion), so only About, Careers, and title/meta text are available. Browser rendering (Puppeteer) is disabled on the free host.
- **Datacenter IP Blocking:** Some sites block datacenter IPs (HTTP 429 or 403), so live enrichment can fail for them. These appear as "Insufficient data" and do not use the daily budget.
- **Live ATS Volatility:** Live ATS data changes over time, so role counts and tech denominators can differ between runs. The shipped seed is a snapshot.
- **Ephemeral Storage on Render:** On Render's free tier the disk is ephemeral. The database is re-seeded from `backend/seed/leads.json` after every restart, and the daily counter resets.
- **Language Scope:** English-language websites only.

---

## Hosting and Deployment

ProofLead is one long-running Node.js web service (Express serving the built React/Vite app), not a static site and not serverless. It is deployed on Render (PaaS, free instance, Singapore region) from the `main` branch with auto-deploy on commit.
- **Build Command:** `npm run install:all && npm run build`
- **Start Command:** `npm start`
- **Runtime:** Node.js v20.x

---

## Setup & Local Run Instructions

### Prerequisites
- Node.js (v20.x recommended)
- NPM

### Local Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Naveen34822/ProofLead.git
   cd ProofLead
   ```
2. Install dependencies:
   ```bash
   npm run install:all
   ```
3. Set environment variables in `.env`:
   ```env
   GROQ_API_KEY=your_groq_api_key
   GROQ_MODEL=openai/gpt-oss-120b
   PUPPETEER_ENABLED=false
   DAILY_LIVE_CAP=25
   PER_IP_LIVE_CAP=5
   PORT=3001
   ```
4. Build the application:
   ```bash
   npm run build
   ```
5. Run the verifier test suite:
   ```bash
   npm test --prefix backend
   ```
6. Start the server:
   ```bash
   npm start
   ```
   Navigate to `http://localhost:3001`.

---

## Screenshots

| Results Dashboard | Supabase Detail Panel |
| :---: | :---: |
| ![Results Table](docs/screenshots/results_table.png) | ![Supabase Panel](docs/screenshots/supabase_panel.png) |

| Notion Detail Panel | Loom Detail Panel |
| :---: | :---: |
| ![Notion Panel](docs/screenshots/notion_panel.png) | ![Loom Panel](docs/screenshots/loom_panel.png) |

---

## Next Steps

- Show public company contact links (LinkedIn company page and generic contact email) found on a company's own website, without scraping LinkedIn or guessing emails.
- Lead discovery by industry and location.
- CRM export (HubSpot, Salesforce) and scheduled re-enrichment.
- Persistent database (hosted Postgres or SQLite on a persistent disk) so the cache and daily counter survive restarts.

---

## Build Notes

**Time:** The handbook asks for no more than 5 hours of coding. My core coding took about 7 hours, so I went about 2 hours over that guideline. I spent additional time on testing, verification, bug fixing and Render deployment. I am stating this plainly rather than fitting the numbers to the limit.

**Scope:** I kept the scope to one core feature: evidence-backed lead qualification and scoring.

**Tools:** I built this with an AI coding assistant. I reviewed and tested its output, caught and fixed several bugs and incorrect reports along the way, and made the product and deployment decisions myself. Groq's gpt-oss-120b is used inside the product for data extraction.
