import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { scoreCompany } from '../frontend/src/utils/scoringEngine.js';

async function testNotion() {
  try {
    const csvData = fs.readFileSync('/Users/naveen/Desktop/Caprae_Capital/20_enriched_test_leads.csv', 'utf8');
    const lines = csvData.split('\n').filter(l => l.trim());
    const header = lines[0].split(',').map(h => h.trim());
    const notionRow = lines.find(l => l.includes('notion.so'));
    
    if (!notionRow) throw new Error('notion.so not found in CSV');
    
    const parts = notionRow.split(',');
    const csvObj = {};
    header.forEach((h, i) => {
      csvObj[h] = parts[i] ? parts[i].trim() : '';
    });

    console.log('Triggering enrichment for notion.so (forceRefresh=true)...');
    const res = await axios.post('http://localhost:3001/api/enrich', {
      domain: 'notion.so',
      forceRefresh: true
    });
    
    let lead = res.data;
    
    // Inject strictly from CSV
    if (csvObj.employees) lead.csvEmployees = csvObj.employees;
    if (csvObj.industry) lead.csvIndustry = csvObj.industry;
    if (csvObj.name) lead.csvName = csvObj.name;
    if (csvObj.location) lead.csvLocation = csvObj.location;
    
    // Check if csv* fields are present in 20_enriched_test_leads.csv (employees and industry)
    if (!csvObj.employees || !csvObj.industry) {
      throw new Error('Missing csv* fields (employees or industry) in 20_enriched_test_leads.csv');
    }

    const icp = {
      industries: ['SaaS', 'Productivity'],
      employeeSizeMin: 50,
      employeeSizeMax: 10000,
      targetLocations: ['San Francisco', 'New York'],
      requireHiring: false,
      targetTech: ['React', 'TypeScript']
    };
    
    const factors = scoreCompany(lead, icp);
    
    console.log('\n--- Final Merged Object for notion.so ---');
    console.log(JSON.stringify({ ...lead, scoreFactors: factors }, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testNotion();
