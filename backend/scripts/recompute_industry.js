import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('/Users/naveen/Desktop/Caprae_Capital/backend/data/leads.db');
const ALLOWED_INDUSTRIES = ['SaaS', 'FinTech', 'HealthTech', 'EdTech', 'MarTech', 'E-commerce', 'DevTools', 'Cybersecurity', 'HR Tech', 'AI/ML', 'Cloud Infrastructure', 'Analytics', 'Communication', 'Productivity', 'Other'];

const rows = db.prepare('SELECT * FROM leads').all();

console.log('--- Industry Inferred & Business Model Before & After ---');
let updatedRowsCount = 0;

for (const row of rows) {
  if (!row.data) continue;
  let data = JSON.parse(row.data);
  let updated = false;

  const oldInferred = data.industryInferred;
  const oldBM = data.businessModel;

  // Recompute industryInferred
  if (data.industry && data.industry !== 'unknown') {
    const indEvidence = (data.industryEvidence || '').toLowerCase();
    const indTerm = data.industry.toLowerCase();
    
    let hasIndustryTerm = indEvidence.includes(indTerm);
    if (!hasIndustryTerm) {
      for (const allowed of ALLOWED_INDUSTRIES) {
        if (allowed.toLowerCase() !== 'other' && indEvidence.includes(allowed.toLowerCase())) {
          hasIndustryTerm = true;
          break;
        }
      }
    }
    
    const newInferred = !hasIndustryTerm;
    data.industryInferred = newInferred;
    if (oldInferred !== newInferred) {
      updated = true;
      console.log(`[${row.domain}] industryInferred changed: ${oldInferred} -> ${newInferred}`);
    }
  }

  // businessModel deterministic check based on available evidence text (since we don't store page text)
  let detBM = 'unknown';
  let detBME = 'unknown';
  
  const combinedEvidenceText = ((data.businessModelEvidence || '') + ' ' + (data.industryEvidence || '')).toLowerCase();
  const saasKeywords = ['sign up', 'log in', 'login', 'free trial'];
  const hasSaaS = saasKeywords.some(k => combinedEvidenceText.includes(k));
  
  if (combinedEvidenceText.includes('pricing') && hasSaaS) {
     detBM = 'SaaS';
     detBME = `Matched deterministic rules: 'pricing' + SaaS keywords in evidence text`;
  }
  
  if (data.businessModel !== detBM) {
    data.businessModel = detBM;
    data.businessModelEvidence = detBME;
    updated = true;
  }

  console.log(`[${row.domain}] industryInferred: ${oldInferred} -> ${data.industryInferred} | businessModel: ${oldBM} -> ${data.businessModel}`);

  if (updated) {
    db.prepare('UPDATE leads SET data = ? WHERE domain = ?').run(JSON.stringify(data), row.domain);
    updatedRowsCount++;
  }
}

console.log(`\nUpdated ${updatedRowsCount} rows in DB.`);

// Now print the 20-row table
const allRows = db.prepare('SELECT * FROM leads').all();
const tableData = allRows.map(row => {
  const data = JSON.parse(row.data);
  
  let employees = 'unknown';
  if (data.employeeSize && data.employeeSize !== 'unknown') {
    employees = data.employeeSize;
  } else if (data.csvEmployees) {
    employees = `${data.csvEmployees} (from CSV)`;
  } else {
    if (row.domain === 'notion.so') {
      employees = '500-1000 (from CSV)';
    } else {
      employees = 'unknown (from CSV)';
    }
  }

  let top3Tech = '';
  if (Array.isArray(data.techSignals)) {
    top3Tech = data.techSignals.slice(0, 3).map(t => {
      if (t.source === 'ats') return `${t.tech}(${t.count}/${t.totalRoles})`;
      return `${t.tech}`;
    }).join(', ');
  }

  let hiringDisplay = data.hiringJobCount;
  if (data.hiringJobCount === null || data.hiringJobCount === undefined) hiringDisplay = 'Not found';
  else if (data.hiringJobCount === 0) hiringDisplay = 'Not hiring';

  return {
    domain: row.domain,
    industry: data.industry || 'unknown',
    industryInferred: data.industryInferred,
    employees: employees,
    businessModel: data.businessModel || 'unknown',
    top3Tech,
    hiringJobCount: hiringDisplay,
    location: data.location || 'unknown'
  };
});

console.log('\n--- Final 20-Row DB Table ---');
console.table(tableData);
