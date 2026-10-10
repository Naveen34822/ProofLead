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
import { USER_AGENT } from './config/ua.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import rateLimit from 'express-rate-limit';

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const liveEnrichLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: parseInt(process.env.PER_IP_LIVE_CAP) || 5, // Limit each IP to 5 requests per `window` (here, per hour)
  skip: (req) => {
    return req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  },
  handler: (req, res, next) => {
    req.rateLimitExceeded = true;
    next();
  }
});

import Database from 'better-sqlite3';

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'leads.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    domain TEXT PRIMARY KEY,
    name TEXT,
    data JSON,
    confidence TEXT,
    score INTEGER,
    status TEXT,
    source TEXT,
    failed_reason TEXT,
    fetched_at TEXT,
    using_cached_from TEXT
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_stats (
    date TEXT PRIMARY KEY,
    count INTEGER
  )
`);


const seedDir = path.join(__dirname, 'seed');
const seedFile = path.join(seedDir, 'leads.json');
const rowCount = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
if (rowCount === 0 && fs.existsSync(seedFile)) {
  console.log('Seeding DB from leads.json...');
  const seedData = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
  const insert = db.prepare(`
    INSERT INTO leads (domain, data, confidence, status, source, fetched_at)
    VALUES (@domain, @data, @confidence, @status, @source, @fetched_at)
  `);
  db.transaction(() => {
    for (const lead of seedData) {
      insert.run({
        domain: lead.domain,
        data: JSON.stringify(lead.data),
        confidence: lead.data.confidence || null,
        status: lead.data.enrichmentStatus || 'success',
        source: lead.data.enrichmentSource || 'live',
        fetched_at: lead.data.fetchedAt || new Date().toISOString()
      });
    }
  })();
}

const TECH_ALIASES = {
  "react.js": "react", "reactjs": "react",
  "node.js": "node.js", "nodejs": "node.js", "node": "node.js",
  "golang": "go",
  "ts": "typescript",
  "js": "javascript",
  "k8s": "kubernetes",
  "postgres": "postgresql",
  "vue.js": "vue", "vuejs": "vue",
  "c++": "c++", "c#": "c#", ".net": ".net"
};

const DISPLAY_NAMES = {
  "react": "React", "python": "Python", "node.js": "Node.js", "aws": "AWS", "gcp": "GCP",
  "java": "Java", "go": "Go", "typescript": "TypeScript", "javascript": "JavaScript",
  "kubernetes": "Kubernetes", "postgresql": "PostgreSQL", "mongodb": "MongoDB",
  "vue": "Vue.js", "angular": "Angular", "django": "Django", "flask": "Flask",
  "docker": "Docker", "redis": "Redis", "elasticsearch": "Elasticsearch", "azure": "Azure",
  "ruby": "Ruby", "rails": "Ruby on Rails", "php": "PHP", "laravel": "Laravel",
  "mysql": "MySQL", "c++": "C++", "c#": "C#", ".net": ".NET", "rust": "Rust",
  "swift": "Swift", "kotlin": "Kotlin", "graphql": "GraphQL", "spring": "Spring",
  "terraform": "Terraform", "next.js": "Next.js", "nuxt": "Nuxt.js",
  "hadoop": "Hadoop", "spark": "Spark", "kafka": "Kafka", "rabbitmq": "RabbitMQ",
  "nginx": "Nginx", "prometheus": "Prometheus", "grafana": "Grafana",
  "snowflake": "Snowflake", "bigquery": "BigQuery", "dynamodb": "DynamoDB",
  "cassandra": "Cassandra", "firebase": "Firebase", "svelte": "Svelte",
  "gatsby": "Gatsby", "fastapi": "FastAPI", "express": "Express"
};

const AMBIGUOUS_WORDS = new Set(["go", "spring", "swift", "spark", "express"]);

const TECH_WHITELIST = new Set([
  "react", "react.js", "reactjs", "python", "node", "node.js", "nodejs", "aws", "gcp", "java", "go", "golang",
  "typescript", "ts", "javascript", "js", "kubernetes", "k8s", "postgresql", "postgres", "mongodb", "vue",
  "angular", "django", "flask", "docker", "redis", "elasticsearch", "azure",
  "ruby", "rails", "php", "laravel", "mysql", "c++", "c#", ".net", "rust",
  "swift", "kotlin", "graphql", "spring", "terraform", "next.js", "nuxt",
  "hadoop", "spark", "kafka", "rabbitmq", "nginx", "prometheus", "grafana",
  "snowflake", "bigquery", "dynamodb", "cassandra", "firebase",
  "svelte", "gatsby", "express", "fastapi", "elixir"
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
  
  $('blockquote').remove();
  $('[class*="testimonial"], [class*="review"], [class*="quote"], [class*="customer-story"]').remove();
  $('[id*="testimonial"], [id*="review"], [id*="quote"], [id*="customer-story"]').remove();
  
  $('*').each(function() { $(this).append(' '); });
  
  let text = $('body').text().replace(/\s+/g, ' ').trim();
  
  if (text.length < 1500) {
    const title = $('title').text();
    const desc = $('meta[name="description"]').attr('content') || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    text = `TITLE: ${title} DESC: ${desc} ${ogDesc} ` + text;
  }
  return text.slice(0, maxLimit);
};

const fetchPage = async (url, usePuppeteer = false, retryCount = 0, isWwwRetry = false, charLimit = 15000) => {
  try {
    if (usePuppeteer && process.env.PUPPETEER_ENABLED !== 'false') {
      console.log(`[Puppeteer] Fetching ${url}...`);
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
      const html = await page.content();
      await browser.close();
      const text = extractText(html, charLimit);
      console.log(`[Puppeteer] Fetched ${url} - Status: 200, Length: ${text.length}`);
      return { text, html };
    }

    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br'
    };

    const res = await axios.get(url, { timeout: 8000, headers, maxRedirects: 5 });
    let text = extractText(res.data, charLimit);
    
    console.log(`Fetched ${url} - Status: ${res.status}, Length: ${text.length}`);
    
    if (text.length < 1500) {
      console.log(`[Fallback] Text < 1500 chars for ${url}, trying Puppeteer...`);
      return await fetchPage(url, true, retryCount, isWwwRetry, charLimit);
    }
    
    return { text, html: res.data };
  } catch (e) {
    if (e.response && e.response.status === 403) {
      return { text: '', html: '', blocked: true, blockedCode: 403, blockedReason: 'HTTP 403' };
    }
    if (e.response && e.response.status === 429) {
      if (retryCount < 2) {
        let waitMs = 2000 * (retryCount + 1);
        if (e.response.headers['retry-after']) {
          const retryAfter = parseInt(e.response.headers['retry-after']);
          if (!isNaN(retryAfter)) {
            waitMs = retryAfter < 10 ? retryAfter * 1000 : waitMs; // if it's seconds and reasonable
          }
        }
        console.warn(`Blocked on ${url} (429). Retrying in ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        return await fetchPage(url, false, retryCount + 1, isWwwRetry, charLimit); // never puppeteer after 429
      } else {
        console.warn(`Failed to bypass bot protection for ${url} (429) after retries.`);
        return { text: '', html: '', blocked: true, blockedCode: 429, blockedReason: `HTTP 429` };
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
    
    
    // Extract boilerplate paragraphs that appear in >50% of roles
    const paragraphCounts = {};
    for (const job of jobsList) {
      const html = (job.descriptionHtml || job.text || "");
      const cleanHtml = html.replace(/<[^>]+>/g, " ");
      const paras = cleanHtml.split(/\r?\n/).map(p => p.trim().replace(/\s+/g, " ")).filter(p => p.length > 50);
      for (const p of paras) {
        paragraphCounts[p] = (paragraphCounts[p] || 0) + 1;
      }
    }
    const boilerplateParas = Object.entries(paragraphCounts)
      .filter(([p, count]) => count > jobsList.length * 0.5)
      .map(([p]) => p);

    let techCounts = {};

    let engineeringRolesCount = 0;
    
    for (const job of jobsList) {
      const title = (job.title || job.text || "").toLowerCase();
      let department = "";
      if (job.categories && job.categories.team) department = job.categories.team;
      else if (job.departments && job.departments[0] && job.departments[0].name) department = job.departments[0].name;
      else if (job.department) department = job.department;
      
      department = department.toLowerCase();
      
      const isEngRole = title.includes("engineer") || title.includes("developer") || title.includes("data") || title.includes("product") ||
                        department.includes("engineer") || department.includes("data") || department.includes("product");
                        
      if (isEngRole) {
        engineeringRolesCount++;
        const textRaw = JSON.stringify(job);
        const textLower = textRaw.toLowerCase();
        const roleTechs = new Set();
        
        for (const tech of TECH_WHITELIST) {
          let found = false;
          if (AMBIGUOUS_WORDS.has(tech)) {
            const capTech = tech.charAt(0).toUpperCase() + tech.slice(1);
            const regex = new RegExp("(?:^|[^a-zA-Z0-9])" + capTech + "(?:[^a-zA-Z0-9]|$)");
            if (regex.test(textRaw)) found = true;
          } else if (tech === "c++" || tech === "c#" || tech === ".net") {
            const escaped = tech.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            const regex = new RegExp("(?:^|\\s)" + escaped + "(?:\\s|$)", "i");
            if (regex.test(textLower)) found = true;
          } else {
            const escaped = tech.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
            const regex = new RegExp("\\b" + escaped + "\\b", "i");
            if (regex.test(textLower)) {
               if (tech === "java" && /\bjavascript\b/i.test(textLower) && !/\bjava\b/i.test(textLower)) {
                 found = false;
               } else {
                 found = true;
               }
            }
          }
          
          if (found) {
            const canonical = TECH_ALIASES[tech] || tech;
            roleTechs.add(canonical);
          }
        }
        
        for (const t of roleTechs) {
          techCounts[t] = (techCounts[t] || 0) + 1;
        }
      }
    }
    
    let atsTechFound = [];

    let atsTechEvidence = '';
    
        if (engineeringRolesCount > 0) {
      const validTechs = Object.entries(techCounts)
        .filter(([tech, tCount]) => tCount >= 3 || (tCount / engineeringRolesCount) >= 0.1)
        .sort((a, b) => b[1] - a[1]);
        
      if (validTechs.length > 0) {
        const domainLabel = domain.split(".")[0].toLowerCase();
        
        for (const [tech, tCount] of validTechs) {
          if (tech !== domainLabel) {
            const displayName = DISPLAY_NAMES[tech] || (tech.charAt(0).toUpperCase() + tech.slice(1));
            atsTechFound.push({
              tech: displayName,
              source: "ats",
              count: tCount,
              totalRoles: engineeringRolesCount
            });
          }
        }
      }
    }

    if (count > 0) {
      return {
        atsDetected: atsData.type,
        hiringSignals: true,
        hiringSignalsEvidence: atsData.url,
        count,
        atsTechFound,
        atsTechEvidence
      };
    } else {
      return {
        atsDetected: atsData.type,
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
  return { atsDetected: atsData ? atsData.type : null, hiringSignals: 'unknown', count: null };
};

app.get('/api/health', (req, res) => res.json({status: 'ok'}));

app.get('/api/budget', (req, res) => {
  const dailyCap = parseInt(process.env.DAILY_LIVE_CAP) || 25;
  try {
    const row = db.prepare("SELECT count FROM daily_stats WHERE date = date('now')").get();
    res.json({ used: row ? row.count : 0, cap: dailyCap });
  } catch(e) {
    res.json({ used: 0, cap: dailyCap });
  }
});


app.post('/api/enrich', liveEnrichLimiter, async (req, res) => {
  const dailyCap = parseInt(process.env.DAILY_LIVE_CAP) || 25;
  let isGlobalCapExceeded = false;
  try {
    const todaysLiveCountRow = db.prepare("SELECT count FROM daily_stats WHERE date = date('now')").get();
    if (todaysLiveCountRow && todaysLiveCountRow.count >= dailyCap) {
       isGlobalCapExceeded = true;
    }
  } catch(e) {
    console.error('Error checking global cap', e);
  }
  const { domain, website, forceRefresh, csvIndustry } = req.body;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const row = db.prepare('SELECT * FROM leads WHERE domain = ?').get(domain);
  let existingCache = null;
  if (row && row.data) {
    try {
      const cachedData = JSON.parse(row.data);
      if (cachedData.textLength < 500 || cachedData.enrichmentStatus === 'failed') {
        console.log(`[${domain}] Ignoring stale cache (text < 500 or failed).`);
      } else {
        if (req.body.forceRefresh) {
          existingCache = cachedData;
          console.log(`Bypassing cache for ${domain} (forceRefresh)...`);
        } else {
          console.log('Serving from DB:', domain);
          return res.json({ ...cachedData, enrichmentSource: 'db' });
        }
      }
    } catch (err) {
      console.warn(`[${domain}] Error reading DB data:`, err.message);
    }
  }


  if (req.rateLimitExceeded || isGlobalCapExceeded) {
    if (existingCache && existingCache.enrichmentStatus === 'success') {
      const reason = isGlobalCapExceeded ? 'global_daily_cap_exceeded' : 'rate_limit_exceeded_ip_max';
      console.log(`[${domain}] ${reason}. Serving cache fallback.`);
      return res.status(200).json({
        ...existingCache,
        usingCachedFrom: existingCache.fetchedAt,
        failedReason: reason
      });
    }
    const errMessage = isGlobalCapExceeded ? `Global Daily Limit exceeded (Max ${dailyCap} live enrichments/day)` : 'IP Rate limit exceeded';
    return res.status(429).json({ error: errMessage, enrichmentStatus: 'failed' });
  }

  const baseUrl = website || (domain.startsWith('http') ? domain : `https://${domain}`);
  
  console.log(`\n--- Fetching data for: ${domain} ---`);
  
  let robotsTxtContent = '';
  const robotsUrl = `${baseUrl}/robots.txt`;
  try {
    const rRes = await axios.get(robotsUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 3000 });
    robotsTxtContent = rRes.data;
  } catch (err) {}
  
  const robots = robotsParser(robotsUrl, robotsTxtContent);
  const ua = USER_AGENT;

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
  
  // Extract meta/first-party text from home page
  const $home = cheerio.load(homeReq.html);
  const pageTitle = $home('title').text().trim();
  const metaDesc = $home('meta[name="description"]').attr('content') || '';
  const h1Text = $home('h1').map((_, el) => $home(el).text().trim()).get().join(' | ');

  const metaText = `HOME PAGE METADATA:\nTitle: ${pageTitle}\nDescription: ${metaDesc}\nH1: ${h1Text}\n\n`;
  const combinedText = metaText + `HOMEPAGE:\n${homeReq.text}\n\nABOUT:\n${aboutReq.text}\n\nCAREERS:\n${careersReq.text}`;
  
  const sources = {
    home: baseUrl,
    about: `${baseUrl}/about`,
    careers: `${baseUrl}/careers`
  };

  const textLength = combinedText.length;
  const pageTextLengths = {
    home: homeReq.text.length,
    about: aboutReq.text.length,
    careers: careersReq.text.length
  };

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
2. industryEvidence: A verbatim quote that describes what the company's product does.
3. industryInferred: boolean. Mark this true if you inferred the industry from the product description.
4. employeeSize: A string hint of the employee size (e.g., "50-200", "1000+"). Often found on about or careers pages. Return "unknown" if unclear.
5. employeeSizeEvidence: Snippet proving the size.
${atsJobs ? `6. hiringSignals: ${atsJobs.hiringSignals}\n7. hiringSignalsEvidence: "${atsJobs.hiringSignalsEvidence}"\n8. hiringJobCount: ${atsJobs.count || 0}` : `6. hiringSignals: "unknown"\n7. hiringSignalsEvidence: "Not found on fetched pages"\n8. hiringJobCount: 0`}
9. location: The company's headquarters or primary office location (city, country). Return "unknown" if not stated.
10. locationEvidence: Snippet proving the location.

Return ONLY a valid JSON object with keys: industry, industryEvidence, industryInferred, employeeSize, employeeSizeEvidence, hiringSignals, hiringSignalsEvidence, hiringJobCount, location, locationEvidence.
CRITICAL RULE: Use ONLY the provided page text. If a field is not stated in the text, return "unknown" for the value and "Not found on fetched pages" for the evidence field. Every non-unknown field must include an exact quote from the text. Testimonials, customer quotes, and job titles are NOT valid evidence for industry or location/HQ. Do not invent any values.

Text to analyze:
${combinedText.slice(0, 30000)}`;

  try {
    console.log('Calling LLM for:', domain);
    if (process.env.DISABLE_LLM === '1') {
      throw new Error('LLM call disabled as per instructions');
    }
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
    
    // Deterministic businessModel check
    let detBM = 'unknown';
    let detBME = 'unknown';
    const lowerText = combinedText.toLowerCase();
    const saasKeywords = ['sign up', 'log in', 'login', 'free trial'];
    const hasSaaS = saasKeywords.some(k => lowerText.includes(k));
    if (lowerText.includes('pricing') && hasSaaS) {
       detBM = 'SaaS';
       const snippetStart = Math.max(0, lowerText.indexOf('pricing') - 30);
       detBME = combinedText.substring(snippetStart, snippetStart + 80).replace(/\s+/g, ' ') + '... [contains SaaS keywords]';
    }
    data.businessModel = detBM;
    data.businessModelEvidence = detBME;
    
    // Tech comes ONLY from ATS
    
    const domainLabel = domain.split('.')[0].toLowerCase();
    const csvNameLabel = (data.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (atsJobs && atsJobs.atsTechFound && atsJobs.atsTechFound.length > 0) {
      data.techSignals = atsJobs.atsTechFound
        .filter(t => t.tech !== domainLabel && (!csvNameLabel || t.tech !== csvNameLabel) && t.tech !== companyName)
        .sort((a, b) => (b.count || 0) - (a.count || 0));

      data.techSignalsEvidence = atsJobs.atsTechEvidence;
    } else {
      data.techSignals = [];
      data.techSignalsEvidence = 'unknown';
    }
    
    if (Array.isArray(data.techSignals)) {
      console.log(`[${domain}] Tech from ATS: [${data.techSignals.map(t => t.tech).join(', ')}]`);
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
    
    // businessModel is deterministically generated, so no LLM verification needed

    if (!verifyEvidence(data.industryEvidence, combinedText)) {
      const reason = `Quote not found in text: "${data.industryEvidence}"`;
      console.warn(`[${domain}] REJECTED industry "${data.industry}". ${reason}`);
      rejectedFields.push({ field: 'industry', value: data.industry, reason });
      data.industry = csvIndustry || 'unknown';
      data.industryEvidence = csvIndustry ? null : 'unknown';
      data.industryInferred = true;
    } else {
      // First party validation
      const firstPartyText = metaText + (aboutReq.text.length > 0 ? aboutReq.text.slice(0, 1500) : '');
      if (!verifyEvidence(data.industryEvidence, firstPartyText)) {
        const reason = `Quote not found in first-party text (Home Meta/H1 or first 1500 chars of About): "${data.industryEvidence}"`;
        console.warn(`[${domain}] REJECTED industry "${data.industry}". ${reason}`);
        rejectedFields.push({ field: 'industry', value: data.industry, reason });
        data.industry = csvIndustry || 'unknown';
        data.industryEvidence = csvIndustry ? null : 'unknown';
        data.industryInferred = true;
      }
    }
    
    if (!verifyEvidence(data.employeeSizeEvidence, combinedText)) {
      const reason = `Quote not found in text: "${data.employeeSizeEvidence}"`;
      console.warn(`[${domain}] REJECTED employeeSize "${data.employeeSize}". ${reason}`);
      rejectedFields.push({ field: 'employeeSize', value: data.employeeSize, reason });
      data.employeeSize = 'unknown';
      data.employeeSizeEvidence = 'unknown';
    }
    
    // Tech signals are strictly from ATS, no verification against website text needed.
    
    if (atsJobs) {
      data.atsDetected = atsJobs.atsDetected;
      data.hiringSignals = atsJobs.hiringSignals;
      data.hiringSignalsEvidence = atsJobs.hiringSignalsEvidence;
      data.hiringJobCount = atsJobs.count; // atsJobs.count is already an integer
    } else {
      data.atsDetected = null;
      data.hiringSignals = 'unknown';
      data.hiringSignalsEvidence = `Not found (fetch returned ${textLength} chars)`;
      data.hiringJobCount = null;
    }

    // Validate location evidence
    let locEvidenceType = 'unknown';
    if (data.location && data.location !== 'unknown') {
      if (!verifyEvidence(data.locationEvidence, combinedText)) {
        const reason = `Quote not found in text: "${data.locationEvidence}"`;
        console.warn(`[${domain}] REJECTED location "${data.location}". ${reason}`);
        rejectedFields.push({ field: 'location', value: data.location, reason });
        data.location = 'unknown';
        data.locationEvidence = 'unknown';
      } else {
        const normLoc = normalize(data.locationEvidence);
        if (normalize(metaText + homeReq.text).includes(normLoc)) locEvidenceType = 'home page';
        else if (normalize(aboutReq.text).includes(normLoc)) locEvidenceType = 'about page';
        else if (normalize(careersReq.text).includes(normLoc)) locEvidenceType = 'careers/job posting';
        else locEvidenceType = 'unknown';
      }
    }
    data.locationEvidenceType = locEvidenceType;
    
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
    data.pageTextLengths = pageTextLengths;
    data.sources = sources;
    data.fetchedAt = new Date().toISOString();
    if (data.enrichmentStatus !== 'blocked' && data.enrichmentStatus !== 'failed') {
      data.enrichmentStatus = 'success';
    }
    const tokens = response?.usage?.total_tokens || null;
    data._diagnostics = { rawLLM, rejectedFields, tokens };
    
    
    if (data.enrichmentStatus === 'success' && data.textLength >= 500) {
      db.prepare(`INSERT INTO daily_stats (date, count) VALUES (date('now'), 1) ON CONFLICT(date) DO UPDATE SET count = count + 1`).run();

      db.prepare(`
        INSERT INTO leads (domain, data, confidence, status, source, fetched_at)
        VALUES (@domain, @data, @confidence, @status, @source, @fetched_at)
        ON CONFLICT(domain) DO UPDATE SET
          data = excluded.data,
          confidence = excluded.confidence,
          status = excluded.status,
          source = excluded.source,
          fetched_at = excluded.fetched_at
      `).run({
        domain,
        data: JSON.stringify(data),
        confidence: data.confidence || null,
        status: data.enrichmentStatus,
        source: data.enrichmentSource,
        fetched_at: data.fetchedAt
      });
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

const PORT = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use('/api', (req, res) => res.status(404).json({error: 'Not found'}));
app.get(/^.*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// app.listen(PORT, () => {
  console.log(`Enrichment server running on http://localhost:${PORT}`);
});

async function run() {
  const s = await checkAtsJobs("<a href=\"https://jobs.ashbyhq.com/supabase\">jobs</a>", "supabase.com");
  if (s) {
    console.log("Supabase:");
    console.log(s.atsTechFound.map(t => t.tech + " (" + t.count + "/" + t.totalRoles + " roles)").join(", "));
  }
  const n = await checkAtsJobs("<a href=\"https://jobs.ashbyhq.com/notion\">jobs</a>", "notion.so");
  if (n) {
    console.log("Notion:");
    console.log(n.atsTechFound.map(t => t.tech + " (" + t.count + "/" + t.totalRoles + " roles)").join(", "));
  }
  process.exit(0);
}
setTimeout(run, 1000);
