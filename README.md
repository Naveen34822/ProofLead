# ProofLead

ProofLead is an automated B2B lead enrichment and scoring tool. It solves the problem of sales teams wasting time on unverified, generic lead lists by programmatically extracting and verifying signals from public company data.

## How it works

- **Data Fetching:** The system fetches the `/`, `/about`, and `/careers` pages of a company using an honest `ProofLeadBot` user-agent while strictly respecting `robots.txt` directives.
- **Dynamic Rendering:** Puppeteer is used exclusively as a fallback for JS-rendered pages that return a `200 OK` status but lack static content.
- **LLM Extraction:** HTML is stripped of navigational noise and sent to the Groq API (models defined in configuration) to extract structured firmographic data.
- **Evidence Verification:** A strict verifier enforces that every extracted data point must include an exact, verbatim quote that physically exists in the scraped page text.
- **ATS APIs:** If a supported ATS (Greenhouse, Lever, or Ashby) is detected on the careers page, the backend queries their public APIs to accurately extract open job counts and parse the tech stack via a whitelist regex.
- **ICP Scoring:** Leads are evaluated against an Ideal Customer Profile (ICP), with strict score caps based on signal coverage (e.g., maximum score of 40 for 1 signal, 65 for 2 signals).
- **Caching:** If live enrichment fails (due to rate limits, timeouts, or blocks), the system falls back to a local JSON cache and labels the data with a "usingCachedFrom" timestamp and the failure reason.

## Known limitations

- The verifier checks that a quote exists verbatim in the text, but it does not contextually verify that the quote proves the claim.
- The company industry is inferred by the LLM from the product description and marked with an `industryInferred` flag, which is an approximation.
- Hiring metrics and tech stacks are currently only extracted if the company uses Greenhouse, Lever, or Ashby.
- Bulk processing is heavily constrained by the Groq API's daily token and rate limits.

## Ethics

- **Honest Bot:** Uses an honest User-Agent (`ProofLeadBot/1.0 (+https://github.com/Naveen34822/ProofLead)`) with a clear contact link.
- **Respectful Crawling:** Fully respects `robots.txt` and does not scrape disallowed paths.
- **No Evasion:** The system will not attempt IP rotation, proxy networks, or evasion techniques when encountering `403 Forbidden` or `429 Too Many Requests`.
- **No PII:** The system processes zero Personally Identifiable Information (PII) and focuses exclusively on firmographic data.

## Architecture

- **Backend:** Node.js and Express.
- **Frontend:** React and Vite.
- **Cache Storage:** Local file system JSON cache (`backend/cache/`).
- **Hosting / Deployment / Cloud Provider:** [Fill after deploy]

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Naveen34822/ProofLead.git
   cd ProofLead
   ```
2. Install dependencies for the root, frontend, and backend:
   ```bash
   npm run install:all
   ```
3. Copy the example environment variables and add your Groq API key:
   ```bash
   cp .env.example .env
   # Edit .env and set GROQ_API_KEY=your_key
   ```
4. Start the application stack (both frontend and backend concurrently):
   ```bash
   npm run dev
   ```
5. To test the evidence verifier engine manually:
   ```bash
   node backend/test_verifier.cjs
   ```

## Dataset

- **File:** `20_enriched_test_leads.csv`
- **Collection Date:** October 9, 2026
- **User-Agent:** `ProofLeadBot/1.0 (+https://github.com/Naveen34822/ProofLead)`

## Time spent

Approximately 18 hours.
