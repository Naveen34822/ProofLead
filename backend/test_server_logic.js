import * as cheerio from "cheerio";
import axios from "axios";
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
const TECH_WHITELIST_ARRAY = Array.from(TECH_WHITELIST);
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
      const paras = cleanHtml.split("
").map(p => p.trim().replace(/s+/g, " ")).filter(p => p.length > 50);
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
        
        let textRaw = JSON.stringify(job);
        
        // Strip boilerplate
        if (boilerplateParas.length > 0) {
           const jobCleanHtml = (job.descriptionHtml || job.text || "").replace(/<[^>]+>/g, " ");
           const jobParas = jobCleanHtml.split("
").map(p => p.trim().replace(/s+/g, " "));
           for (const p of jobParas) {
              if (boilerplateParas.includes(p)) {
                 textRaw = textRaw.replace(p, " ");
              }
           }
        }
        
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
}
run();
