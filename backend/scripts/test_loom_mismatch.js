import Database from 'better-sqlite3';
import { scoreCompany } from '/Users/naveen/Desktop/Caprae_Capital/frontend/src/utils/scoringEngine.js';

const db = new Database('/Users/naveen/Desktop/Caprae_Capital/backend/data/leads.db');
const row = db.prepare("SELECT * FROM leads WHERE domain = 'loom.com'").get();
const company = JSON.parse(row.data);
company.domain = 'loom.com';
company.csvEmployees = 'unknown';

const icpWithMismatch = {
  industries: ['SaaS', 'FinTech'],
  employeeMin: 50,
  employeeMax: 1000,
  locations: [],
  techStack: ['react']
};

console.log('--- EXACT ICP OBJECT USED ---');
console.log(JSON.stringify(icpWithMismatch, null, 2));

console.log('\n--- LOOM PANEL VALUES (Industry Mismatch) ---');
console.log(JSON.stringify(scoreCompany(company, icpWithMismatch), null, 2));
