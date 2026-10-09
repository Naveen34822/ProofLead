import * as dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import robotsParser from 'robots-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import rateLimit from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const liveEnrichLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per `window` (here, per hour)
  skip: (req) => {
    return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  },
  handler: (req, res, next) => {
    req.rateLimitExceeded = true;
    next();
  }
});

const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

const TECH_WHITELIST = new Set([
  'react', 'python', 'node', 'node.js', 'aws', 'gcp', 'java', 'go', 'golang',
  'typescript', 'javascript', 'kubernetes', 'postgresql', 'mongodb', 'vue',
  'angular', 'django', 'flask', 'docker', 'redis', 'elasticsearch', 'azure',
  'ruby', 'rails', 'php', 'laravel', 'mysql', 'c++', 'c#', '.net', 'rust',
  'swift', 'kotlin', 'graphql', 'spring', 'terraform', 'next.js', 'nuxt',
  'hadoop', 'spark', 'kafka', 'rabbitmq', 'nginx', 'prometheus', 'grafana',
  'snowflake', 'bigquery', 'dynamodb', 'cassandra', 'supabase', 'firebase',
  'svelte', 'remix', 'gatsby', 'express', 'fastapi', 'gin', 'echo'
]);
const TECH_BLACKLIST = new Set([
  'mac', 'macos', 'windows', 'ios', 'android', 'linux', 'chrome', 'firefox',
  'safari', 'edge', 'opera', 'iphone', 'ipad', 'web', 'mobile', 'desktop'
]);

// Ensure you set GROQ_API_KEY in your environment before running
console.log('Groq API Key loaded from environment:', !!process.env.GROQ_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key' });

const extractText = (html, maxLimit = 15000) => {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, img, svg, header, footer, nav').remove();
  
  $('*').each(function() { $(this).append(' '); });
  
  let text = $('body').text().replace(/\s+/g, ' ').trim();
  
  if (text.length < 500) {
    const title = $('title').text();
    const desc = $('meta[name="description"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    text = `TITLE: ${title} DESC: ${desc} ${ogDesc} ` + text;
  }
  return text.slice(0, maxLimit);
};

const fetchPage = async (url, usePuppeteer = false, retryCount = 0, isWwwRetry = false, charLimit = 15000) => {
  try {
    if (usePuppeteer) {
      console.log(`[Puppeteer] Fetching ${url}...`);
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.setUserAgent('ProofLeadBot/1.0 (+https://github.com/CapraeCapital/ProofLead)');
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      const html = await page.content();
      await browser.close();
      const text = extractText(html, charLimit);
      console.log(`[Puppeteer] Fetched ${url} - Status: 200, Length: ${text.length}`);
      return { text, html };
    }

    const headers = {
      'User-Agent': 'ProofLeadBot/1.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br'
    };

    const res = await axios.get(url, { timeout: 8000, headers, maxRedirects: 5 });
    let text = extractText(res.data, charLimit);
    
    console.log(`Fetched ${url} - Status: ${res.status}, Length: ${text.length}`);
    
    if (text.length < 500) {
      console.log(`[Fallback] Text < 500 chars for ${url}, trying Puppeteer...`);
      return await fetchPage(url, true, retryCount, isWwwRetry, charLimit);
    }
    
    return { text, html: res.data };
  } catch (e) {
    if (e.response && (e.response.status === 429 || e.response.status === 403)) {
      if (retryCount < 2) {
        let waitMs = 2000 * (retryCount + 1);
        if (e.response.headers['retry-after']) {
          const retryAfter = parseInt(e.response.headers['retry-after']);
          if (!isNaN(retryAfter)) {
            waitMs = retryAfter < 10 ? retryAfter * 1000 : waitMs; // if it's seconds and reasonable
          }
        }
        console.warn(`Blocked on ${url} (${e.response.status}). Retrying in ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        return await fetchPage(url, usePuppeteer, retryCount + 1, isWwwRetry);
      } else {
        console.warn(`Failed to bypass bot protection for ${url} (${e.response.status}) after retries.`);
        return { text: '', html: '', blocked: true, blockedCode: e.response.status, blockedReason: `HTTP ${e.response.status}` };
      }
    }

    if (!isWwwRetry && !usePuppeteer) {
      try {
        const parsed = new URL(url);
        if (!parsed.hostname.startsWith('www.')) {
          parsed.hostname = 'www.' + parsed.hostname;
          console.log(`[Fallback] Retrying with www: ${parsed.toString()}`);
          return await fetchPage(parsed.toString(), false, 0, true);
        }
      } catch (err) {}
    }
    console.warn(`Failed to fetch ${url} - Error: ${e.message}`);
    return { text: '', html: '' };
  }
};

const checkAtsJobs = async (careersHtml, domain) => {
  const $ = cheerio.load(careersHtml);
  let atsData = null;

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('boards.greenhouse.io/')) {
      const token = href.split('boards.greenhouse.io/')[1].split('/')[0];
      if (token) atsData = { type: 'greenhouse', token, url: href };
    } else if (href.includes('jobs.lever.co/')) {
      const token = href.split('jobs.lever.co/')[1].split('/')[0];
      if (token) atsData = { type: 'lever', token, url: href };
    } else if (href.includes('jobs.ashbyhq.com/')) {
      const token = href.split('jobs.ashbyhq.com/')[1].split('/')[0];
      if (token) atsData = { type: 'ashby', token, url: href };
    }
  });

  if (!atsData) return null;

  try {
    let count = 0;
    let jobsList = [];
    if (atsData.type === 'greenhouse') {
      const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${atsData.token}/jobs`);
      jobsList = res.data?.jobs || [];
      count = jobsList.length;
    } else if (atsData.type === 'lever') {
      const res = await axios.get(`https://api.lever.co/v0/postings/${atsData.token}`);
      jobsList = res.data || [];
      count = jobsList.length;
    } else if (atsData.type === 'ashby') {
      const res = await axios.get(`https://api.ashbyhq.com/posting-api/job-board/${atsData.token}`);
      jobsList = res.data?.jobs || [];
      count = jobsList.length;
      console.log(`[${domain}] Ashby response status: ${res.status}, count: ${count}`);
    }
    
    let atsTechFound = [];
    let atsTechEvidence = '';
    
    for (const job of jobsList) {
      const title = job.title || job.text || '';
      const textToSearch = (JSON.stringify(job)).toLowerCase();
      for (const tech of TECH_WHITELIST) {
        if (!atsTechFound.includes(tech)) {
          const escaped = tech.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i');
          if (regex.test(textToSearch)) {
            atsTechFound.push(tech);
            if (!atsTechEvidence) atsTechEvidence = `Found in ATS job description for ${title}`;
          }
        }
      }
    }
    
    if (count > 0) {
      return {
        hiringSignals: true,
        hiringSignalsEvidence: atsData.url,
        count,
        atsTechFound,
        atsTechEvidence
      };
    } else {
      return {
        hiringSignals: false,
        hiringSignalsEvidence: atsData.url,
        count: 0,
        atsTechFound,
        atsTechEvidence
      };
    }
  } catch (err) {
    console.warn(`[${domain}] ATS API fetch failed for ${atsData.type}:`, err.message);
  }
  return null;
};

app.post('/api/enrich', liveEnrichLimiter, async (req, res) => {
  const { domain, website, forceRefresh } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const cachePath = path.join(cacheDir, `${domain}.json`);
  let existingCache = null;
  if (fs.existsSync(cachePath)) {
    try {
      const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (cachedData.textLength < 500 || cachedData.enrichmentStatus === 'failed') {
        console.log(`[${domain}] Ignoring stale cache (text < 500 or failed).`);
      } else {
        if (req.body.forceRefresh) {
          existingCache = cachedData;
          console.log(`Bypassing cache for ${domain} (forceRefresh)...`);
        } else {
          console.log('Serving from cache:', domain);
          return res.json(cachedData);
        }
      }
    } catch (err) {
      console.warn(`[${domain}] Error reading cache file:`, err.message);
    }
  }

  if (req.rateLimitExceeded) {
    if (existingCache && existingCache.enrichmentStatus === 'success') {
      console.log(`[${domain}] Rate limit exceeded. Serving cache fallback.`);
      return res.status(200).json({
        ...existingCache,
        usingCachedFrom: existingCache.fetchedAt,
        failedReason: 'rate_limit_exceeded_ip_max_5'
      });
    }
    return res.status(429).json({ error: 'IP Rate limit exceeded (Max 5 live companies)', enrichmentStatus: 'failed' });
  }

  const baseUrl = website || (domain.startsWith('http') ? domain : `https://${domain}`);
  
  console.log(`\n--- Fetching data for: ${domain} ---`);
  
  let robotsTxtContent = '';
  const robotsUrl = `${baseUrl}/robots.txt`;
  try {
    const rRes = await axios.get(robotsUrl, { timeout: 3000 });
    robotsTxtContent = rRes.data;
  } catch (err) {}
  
  const robots = robotsParser(robotsUrl, robotsTxtContent);
  const ua = 'ProofLeadBot/1.0 (+https://github.com/CapraeCapital/ProofLead)';

  const checkAndFetch = async (url, charLimit) => {
    if (robotsTxtContent && !robots.isAllowed(url, ua)) {
      console.log(`[${domain}] Disallowed by robots.txt: ${url}`);
      return { text: '', html: '', blocked: true, blockedReason: 'disallowed by robots.txt', blockedCode: 403 };
    }
    return fetchPage(url, false, 0, false, charLimit);
  };

  const [homeReq, aboutReq, careersReq] = await Promise.all([
    checkAndFetch(baseUrl, 6000),
    checkAndFetch(`${baseUrl}/about`, 3000),
    checkAndFetch(`${baseUrl}/careers`, 3000)
  ]);

  const restoreCacheOrReturn = (responseData, httpStatus = 200) => {
    if (responseData.enrichmentStatus !== 'success' && existingCache && existingCache.enrichmentStatus === 'success' && existingCache.textLength >= 500) {
      console.log(`[${domain}] Restoring previous good cache from ${existingCache.fetchedAt}.`);
      let mergedData = { 
         ...existingCache, 
         usingCachedFrom: existingCache.fetchedAt,
         failedReason: responseData.failedReason || responseData.blockedReason || responseData.error || 'unknown_failure'
      };
      return res.status(200).json(mergedData);
    }
    return res.status(httpStatus).json(responseData);
  };

  if (homeReq.blocked || aboutReq.blocked || careersReq.blocked) {
    const blockedCode = homeReq.blockedCode || aboutReq.blockedCode || careersReq.blockedCode;
    const blockedReason = homeReq.blockedReason || aboutReq.blockedReason || careersReq.blockedReason || `HTTP ${blockedCode}`;
    console.warn(`[${domain}] Blocked by site. Returning blocked status.`);
    return restoreCacheOrReturn({ enrichmentStatus: 'blocked', blockedCode, blockedReason });
  }

  const atsJobs = await checkAtsJobs(careersReq.html || homeReq.html, domain);
  
  const combinedText = `HOMEPAGE:\n${homeReq.text}\n\nABOUT:\n${aboutReq.text}\n\nCAREERS:\n${careersReq.text}`;
  
  const sources = {
    home: baseUrl,
    about: `${baseUrl}/about`,
    careers: `${baseUrl}/careers`
  };

  const textLength = combinedText.length;

  if (textLength < 500 && !atsJobs) {
     console.warn(`[${domain}] Text length < 500 (${textLength} chars) and no ATS. Failing fetch.`);
     return restoreCacheOrReturn({ error: `Text length too small (${textLength} chars). Marking as failed.`, enrichmentStatus: 'failed', failedReason: 'text_length_too_small', textLength }, 500);
  }

  if (!combinedText.trim() && !atsJobs) {
     return restoreCacheOrReturn({ error: 'Could not fetch any text from website', enrichmentStatus: 'failed', failedReason: 'no_text_fetched', textLength: 0 }, 500);
  }

  const ALLOWED_INDUSTRIES = ['SaaS', 'FinTech', 'HealthTech', 'EdTech', 'MarTech', 'E-commerce', 'DevTools', 'Cybersecurity', 'HR Tech', 'AI/ML', 'Cloud Infrastructure', 'Analytics', 'Communication', 'Productivity', 'Other'];

  const prompt = `Analyze the following website text for ${domain} and extract these data points in valid JSON format:
1. industry: The primary industry or vertical based on what the company does. MUST be one of: ${ALLOWED_INDUSTRIES.join(', ')}. Return "Other" or "unknown" if unclear.
2. industryEvidence: A verbatim quote that describes the product or business, used as evidence for your chosen industry.
3. industryInferred: boolean. Mark this true if you inferred the industry from the product description.
4. employeeSize: A string hint of the employee size (e.g., "50-200", "1000+"). Often found on about or careers pages. Return "unknown" if unclear.
5. employeeSizeEvidence: Snippet proving the size.
6. techSignals: Array of strings — ONLY recognised programming languages, frameworks, cloud providers, or databases (e.g. React, Python, AWS, PostgreSQL). Do NOT include operating systems (Mac, Windows, iOS, Android, Linux) or browsers.
7. techSignalsEvidence: Snippet proving the tech stack.
${atsJobs ? `8. hiringSignals: ${atsJobs.hiringSignals}\n9. hiringSignalsEvidence: "${atsJobs.hiringSignalsEvidence}"\n10. hiringJobCount: ${atsJobs.count || 0}` : `8. hiringSignals: "unknown"\n9. hiringSignalsEvidence: "Not found on fetched pages"\n10. hiringJobCount: 0`}
11. location: The company's headquarters or primary office location (city, country). Return "unknown" if not stated.
12. locationEvidence: Snippet proving the location.

Return ONLY a valid JSON object with keys: industry, industryEvidence, industryInferred, employeeSize, employeeSizeEvidence, techSignals, techSignalsEvidence, hiringSignals, hiringSignalsEvidence, hiringJobCount, location, locationEvidence.
CRITICAL RULE: Use ONLY the provided page text. If a field is not stated in the text, return "unknown" for the value and "Not found on fetched pages" for the evidence field. Every non-unknown field must include an exact quote from the text. Do not invent any values.

Text to analyze:
${combinedText.slice(0, 30000)}`;

  try {
    console.log('Calling LLM for:', domain);
    const primaryModel = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    const fallbackModel = 'openai/gpt-oss-20b';
    
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    let currentModel = primaryModel;
    console.log(`[${domain}] Using model: ${currentModel}`);
    
    while (attempts < maxAttempts) {
      try {
        response = await groq.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });
        break; // Success
      } catch (err) {
        attempts++;
        const isRateLimit = err.status === 429 || err.status === 503;
        console.warn(`[${domain}] Attempt ${attempts} with ${currentModel} failed: ${err.message}`);
        
        if (attempts >= maxAttempts) {
          if (currentModel === primaryModel) {
            console.warn(`[${domain}] Primary model failed 3 times. Falling back to ${fallbackModel}...`);
            currentModel = fallbackModel;
            attempts = 0; // reset attempts for fallback
            continue;
          }
          throw err; // Ultimate failure
        }
        
        if (isRateLimit) {
          const delay = Math.pow(2, attempts) * 1000 + Math.random() * 500;
          console.log(`[${domain}] Rate limited. Waiting ${Math.round(delay)}ms...`);
          await new Promise(r => setTimeout(r, delay));
        } else if (err.status === 400 && err.error?.error?.code === 'json_validate_failed') {
          console.log(`[${domain}] JSON parse error. Retrying...`);
        } else {
          // Force fallback switch on other errors
          if (currentModel === primaryModel) {
            console.warn(`[${domain}] Non-rate-limit error. Switching to ${fallbackModel}...`);
            currentModel = fallbackModel;
            attempts = 0;
            continue;
          }
          throw err;
        }
      }
    }

    let data = JSON.parse(response.choices[0].message.content);
    
    // Filter tech stack: reject blacklisted, require whitelist match
    if (Array.isArray(data.techSignals)) {
      data.techSignals = data.techSignals.filter(t => {
        const lower = t.toLowerCase().trim();
        if (TECH_BLACKLIST.has(lower)) return false;
        return TECH_WHITELIST.has(lower);
      });
      if (data.techSignals.length === 0) {
        data.techSignalsEvidence = 'unknown';
      }
    }
    
    // Inject ATS tech
    if (atsJobs && atsJobs.atsTechFound && atsJobs.atsTechFound.length > 0) {
      const existingTech = Array.isArray(data.techSignals) ? data.techSignals : [];
      data.techSignals = Array.from(new Set([...existingTech, ...atsJobs.atsTechFound]));
      if (!data.techSignalsEvidence || data.techSignalsEvidence === 'unknown') {
        data.techSignalsEvidence = atsJobs.atsTechEvidence;
      } else {
        data.techSignalsEvidence += ` | ${atsJobs.atsTechEvidence}`;
      }
    }
    
    if (Array.isArray(data.techSignals)) {
      console.log(`[${domain}] Tech after whitelist filter: [${data.techSignals.join(', ')}]`);
    }
    
    // Verification step
    const normalize = (str) => String(str).toLowerCase().replace(/[\u2018\u2019\u201C\u201D"']/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const verifyEvidence = (evidence, fullText) => {
      if (!evidence || evidence === 'unknown' || evidence === 'Not found on fetched pages') return true;
      if (String(evidence).startsWith('Found in ATS')) return true;
      const normalizedEvidence = normalize(evidence);
      const normalizedText = normalize(fullText);
      return normalizedText.includes(normalizedEvidence);
    };
    
    const rawLLM = Object.assign({}, data);
    const rejectedFields = [];
    
    console.log(`[${domain}] RAW LLM DATA: ${JSON.stringify(data)}`);

    if (!verifyEvidence(data.industryEvidence, combinedText)) {
      const reason = `Quote not found in text: "${data.industryEvidence}"`;
      console.warn(`[${domain}] REJECTED industry "${data.industry}". ${reason}`);
      rejectedFields.push({ field: 'industry', value: data.industry, reason });
      data.industry = 'unknown';
      data.industryEvidence = 'unknown';
    }
    
    if (!verifyEvidence(data.employeeSizeEvidence, combinedText)) {
      const reason = `Quote not found in text: "${data.employeeSizeEvidence}"`;
      console.warn(`[${domain}] REJECTED employeeSize "${data.employeeSize}". ${reason}`);
      rejectedFields.push({ field: 'employeeSize', value: data.employeeSize, reason });
      data.employeeSize = 'unknown';
      data.employeeSizeEvidence = 'unknown';
    }
    
    if (!verifyEvidence(data.techSignalsEvidence, combinedText)) {
      const reason = `Quote not found in text: "${data.techSignalsEvidence}"`;
      console.warn(`[${domain}] REJECTED techSignals "[${data.techSignals.join(',')}]". ${reason}`);
      rejectedFields.push({ field: 'techSignals', value: data.techSignals, reason });
      data.techSignals = [];
      data.techSignalsEvidence = 'unknown';
    }
    
    if (atsJobs) {
      data.hiringSignals = atsJobs.hiringSignals;
      data.hiringSignalsEvidence = atsJobs.hiringSignalsEvidence;
      data.hiringJobCount = atsJobs.count || 0;
    } else {
      data.hiringSignals = 'unknown';
      data.hiringSignalsEvidence = `Not found (fetch returned ${textLength} chars)`;
      data.hiringJobCount = 0;
    }

    // Validate location evidence
    if (data.location && data.location !== 'unknown') {
      if (!verifyEvidence(data.locationEvidence, combinedText)) {
        const reason = `Quote not found in text: "${data.locationEvidence}"`;
        console.warn(`[${domain}] REJECTED location "${data.location}". ${reason}`);
        rejectedFields.push({ field: 'location', value: data.location, reason });
        data.location = 'unknown';
        data.locationEvidence = 'unknown';
      }
    }
    
    // Compute confidence (only verified LLM fields)
    let verifiedScore = 0;
    if (data.industry && data.industry !== 'unknown') verifiedScore++;
    if (data.employeeSize && data.employeeSize !== 'unknown') verifiedScore++;
    if (data.techSignals && data.techSignals.length > 0) verifiedScore++;
    
    let baseConfidence = verifiedScore >= 3 ? 'high' : verifiedScore >= 2 ? 'medium' : 'low';
    
    const hasAtsHiring = data.hiringSignals !== 'unknown' && data.hiringJobCount > 0;
    
    // ATS hiring data lifts low to medium, but cannot lift medium to high.
    if (baseConfidence === 'low' && hasAtsHiring) {
      data.confidence = 'medium';
    } else {
      data.confidence = baseConfidence;
    }
    data.enrichmentSource = 'live';
    data.textLength = textLength;
    data.sources = sources;
    data.fetchedAt = new Date().toISOString();
    if (data.enrichmentStatus !== 'blocked' && data.enrichmentStatus !== 'failed') {
      data.enrichmentStatus = 'success';
    }
    data._diagnostics = { rawLLM, rejectedFields };
    
    if (data.enrichmentStatus === 'success' && data.textLength >= 500) {
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    } else {
      console.warn(`[${domain}] Not caching because enrichmentStatus is ${data.enrichmentStatus} or textLength < 500.`);
    }
    
    return restoreCacheOrReturn(data);
  } catch (err) {
    const fullError = typeof err === 'object' ? JSON.stringify(err, null, 2) : err.message;
    console.error(`[${domain}] LLM parsing failed:`, fullError, err.message);
    return restoreCacheOrReturn({ 
      error: err.message || 'Failed to parse LLM response',
      enrichmentStatus: 'failed',
      failedReason: 'llm_error: ' + (err.message || 'unknown'),
      textLength: textLength || 0
    }, 500);
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Enrichment server running on http://localhost:${PORT}`);
});
