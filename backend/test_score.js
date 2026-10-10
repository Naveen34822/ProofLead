import fs from 'fs';
import { scoreCompany } from '../frontend/src/utils/scoringEngine.js';

const leads = JSON.parse(fs.readFileSync('backend/leads.json', 'utf8'));

const icp = { industries: [], techStack: [], employeeMin: 0, employeeMax: 0, locations: [] };

for (const key of ['supabase.com', 'notion.so', 'loom.com']) {
  if (leads[key]) {
     const result = scoreCompany(leads[key], icp);
     console.log("=== " + key + " ===");
     console.log("Score:", result.score);
     console.log("Factors:", result.factors);
  }
}
