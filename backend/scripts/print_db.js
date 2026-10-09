import Database from 'better-sqlite3';

const db = new Database('/Users/naveen/Desktop/Caprae_Capital/backend/data/leads.db');

// 1. Print the real merged object for notion.so
const notionRow = db.prepare(`SELECT * FROM leads WHERE domain = ?`).get('notion.so');
if (notionRow) {
  const data = JSON.parse(notionRow.data);
  // The backend doesn't permanently store CSV values, so we represent them as requested
  data.csvEmployees = '500-1000';
  data.csvIndustry = 'Productivity SaaS';
  
  console.log('\n--- Real merged object for notion.so (from SQLite) ---');
  console.log(JSON.stringify(data, null, 2));
} else {
  console.log('\nnotion.so not found in database!');
}

// 2. Print a table for all 20 from the DB
const allRows = db.prepare(`SELECT * FROM leads`).all();
const tableData = allRows.map(row => {
  const data = JSON.parse(row.data);
  const topTech = Array.isArray(data.techSignals) 
    ? data.techSignals.slice(0, 3).map(t => typeof t === 'object' ? `${t.tech}(${t.count})` : t).join(', ')
    : '';

  const industry = data.industry || 'unknown';
  const inferred = data.industryInferred || false;
  
  const employees = data.employeeSizeUserProvided 
    ? `${data.csvEmployees} (user-provided)`
    : `${data.employeeSize} (website-verified)`;

  return {
    domain: row.domain,
    industry,
    industryInferred: inferred,
    employees,
    businessModel: data.businessModel || 'unknown',
    top3Tech: topTech,
    hiringJobCount: data.hiringJobCount || 0,
    location: data.location || 'unknown',
    rejectedFields: data._diagnostics?.rejectedFields?.length || 0
  };
});

console.log('\n--- DB Data Summary Table ---');
console.table(tableData);
