import Database from 'better-sqlite3';
import { scoreCompany } from '/Users/naveen/Desktop/Caprae_Capital/frontend/src/utils/scoringEngine.js';

const db = new Database('/Users/naveen/Desktop/Caprae_Capital/backend/data/leads.db');
const rows = db.prepare("SELECT * FROM leads").all();

const icpWithLocation = {
  industries: ['SaaS', 'DevTools', 'Communication', 'FinTech', 'Productivity'],
  employeeMin: 50,
  employeeMax: 1000,
  locations: ['San Francisco'],
  techStack: ['react', 'node']
};

const table = [];

for (const row of rows) {
  if (!row.data) continue;
  const company = JSON.parse(row.data);
  company.domain = row.domain;
  
  const scored = scoreCompany(company, icpWithLocation);
  
  table.push({
    Domain: row.domain,
    Score: scored.score,
    'Sig': `${scored.validSignals}/${scored.totalSignals}`,
    Industry: company.industry,
    IndInferred: company.industryInferred,
    Employees: company.employeeSize,
    BusinessModel: company.businessModel,
    Hiring: company.hiringJobCount,
    Location: company.location
  });
}

console.table(table);
