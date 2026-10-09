import Database from 'better-sqlite3';
import { scoreCompany } from '/Users/naveen/Desktop/Caprae_Capital/frontend/src/utils/scoringEngine.js';
const db = new Database('/Users/naveen/Desktop/Caprae_Capital/backend/data/leads.db');
const row = db.prepare("SELECT * FROM leads WHERE domain = 'loom.com'").get();
const company = JSON.parse(row.data);
company.domain = 'loom.com';
company.csvEmployees = 'unknown';

const icpWithLocation = {
  industries: ['Productivity', 'DevTools', 'Communication'],
  employeeMin: 50,
  employeeMax: 1000,
  locations: ['San Francisco'],
  techStack: ['react']
};

const icpWithoutLocation = {
  industries: ['Productivity', 'DevTools', 'Communication'],
  employeeMin: 50,
  employeeMax: 1000,
  locations: [],
  techStack: ['react']
};

console.log('--- LOOM PANEL VALUES (With Location Target) ---');
console.log(JSON.stringify(scoreCompany(company, icpWithLocation), null, 2));

console.log('\n--- LOOM PANEL VALUES (Without Location Target) ---');
console.log(JSON.stringify(scoreCompany(company, icpWithoutLocation), null, 2));
