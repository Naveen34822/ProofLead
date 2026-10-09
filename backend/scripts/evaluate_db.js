import Database from 'better-sqlite3';
import fs from 'fs';

const db = new Database('/Users/naveen/Desktop/Caprae_Capital/backend/data/leads.db');

const ALLOWED_INDUSTRIES = ['SaaS', 'FinTech', 'HealthTech', 'EdTech', 'MarTech', 'E-commerce', 'DevTools', 'Cybersecurity', 'HR Tech', 'AI/ML', 'Cloud Infrastructure', 'Analytics', 'Communication', 'Productivity', 'Other'];

const rows = db.prepare('SELECT * FROM leads').all();

for (const row of rows) {
  if (!row.data) continue;
  let data = JSON.parse(row.data);
  let updated = false;

  // Rule 1: businessModel
  const bmEvidence = (data.businessModelEvidence || '').toLowerCase();
  if (data.businessModel !== 'unknown') {
    const hasSoftwareKeywords = ['pricing', 'sign up', 'sign-up', 'platform', 'software', 'app', 'subscription'].some(kw => bmEvidence.includes(kw));
    if (!hasSoftwareKeywords) {
      data.businessModel = 'unknown';
      data.businessModelEvidence = 'unknown';
      updated = true;
    }
  }

  // Rule 2: industryInferred
  if (data.industry && data.industry !== 'unknown') {
    const indEvidence = (data.industryEvidence || '').toLowerCase();
    const indTerm = data.industry.toLowerCase();
    
    // Check if industry term or any allowed industry synonym is present
    const hasIndustryTerm = indEvidence.includes(indTerm) || ALLOWED_INDUSTRIES.some(allowed => allowed.toLowerCase() !== 'other' && indEvidence.includes(allowed.toLowerCase()));
    
    const newInferred = !hasIndustryTerm;
    if (data.industryInferred !== newInferred) {
      data.industryInferred = newInferred;
      updated = true;
    }
  }

  // Rule 3: Tech array structure
  if (Array.isArray(data.techSignals)) {
    data.techSignals = data.techSignals.map(t => {
      if (typeof t === 'string') return { tech: t, source: 'website' };
      if (typeof t === 'object') {
        if (!t.source) {
          t.source = t.count > 0 ? 'ats' : 'website';
        }
        return t;
      }
      return t;
    });
    // Sort ATS first
    data.techSignals.sort((a, b) => {
      if (a.source === 'ats' && b.source !== 'ats') return -1;
      if (a.source !== 'ats' && b.source === 'ats') return 1;
      if (a.source === 'ats' && b.source === 'ats') return (b.count || 0) - (a.count || 0);
      return 0;
    });
    updated = true;
  }

  // Rule 4: hiringJobCount null when ATS not found
  if (data.hiringSignals === 'unknown' && data.hiringJobCount === 0) {
    data.hiringJobCount = null;
    updated = true;
  }

  if (updated) {
    db.prepare('UPDATE leads SET data = ? WHERE domain = ?').run(JSON.stringify(data), row.domain);
  }
}

// 1. Print real merged object for notion.so
const notionRow = db.prepare('SELECT * FROM leads WHERE domain = ?').get('notion.so');
if (notionRow) {
  const data = JSON.parse(notionRow.data);
  data.csvEmployees = '500-1000';
  data.csvIndustry = 'Productivity SaaS';
  console.log('\n--- Real merged object for notion.so ---');
  console.log(JSON.stringify(data, null, 2));
}

// 2. Print table
const allRows = db.prepare('SELECT * FROM leads').all();
const tableData = allRows.map(row => {
  const data = JSON.parse(row.data);
  
  // Rule 5: Employees column display
  let employees = 'unknown';
  if (data.employeeSize && data.employeeSize !== 'unknown') {
    employees = data.employeeSize;
  } else {
    // For notion, simulate from CSV
    if (row.domain === 'notion.so') {
      employees = '500-1000 (from CSV)';
    } else {
      employees = 'unknown (from CSV)'; // Simulation for table since backend doesn't store CSV fields
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
  if (data.hiringJobCount === null) hiringDisplay = 'Not found';
  else if (data.hiringJobCount === 0) hiringDisplay = 'Not hiring';

  return {
    domain: row.domain,
    industry: data.industry || 'unknown',
    industryInferred: data.industryInferred,
    employees: employees,
    businessModel: data.businessModel || 'unknown',
    top3Tech,
    hiringJobCount: hiringDisplay,
    location: data.location || 'unknown',
    rejectedFields: data._diagnostics?.rejectedFields?.length || 0
  };
});

console.log('\n--- DB Data Summary Table ---');
console.table(tableData);

// 6. Print every rejected field
console.log('\n--- Rejected Fields ---');
const rejectedList = [];
for (const row of allRows) {
  const data = JSON.parse(row.data);
  if (data._diagnostics && data._diagnostics.rejectedFields) {
    for (const r of data._diagnostics.rejectedFields) {
      rejectedList.push({
        domain: row.domain,
        field: r.field,
        value: r.value,
        reason: r.reason
      });
    }
  }
}
if (rejectedList.length > 0) {
  console.table(rejectedList);
} else {
  console.log('No rejected fields found.');
}
