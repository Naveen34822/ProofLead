import axios from 'axios';
import { scoreCompany } from '/Users/naveen/Desktop/Caprae_Capital/frontend/src/utils/scoringEngine.js';

async function run() {
  const domain = 'loom.com';
  const website = 'https://www.loom.com';
  
  // CSV details based on requirement: size taken from CSV (label "from CSV")
  // Actually, we pass csvIndustry to the API. Let's say csvIndustry is 'Communication'.
  // And csvEmployees is '200-500' or similar, let's use what's typical or '200-500 (from CSV)' 
  // No, the UI handles `(from CSV)`. 
  // Let's pass csvEmployees = '200-500'.
  
  const csvIndustry = 'Communication';
  
  try {
    console.log(`\n================ Processing ${domain} ================`);
    const res = await axios.post('http://localhost:3001/api/enrich', {
      domain,
      website,
      forceRefresh: true,
      csvIndustry
    });

    const data = res.data;
    data.domain = domain;
    
    // UI merge mock
    if (data.employeeSize === 'unknown') {
      data.employeeSize = '200-500';
      data.employeeSizeUserProvided = true;
    }
    
    // Adjust employeeSize property for scoreCompany
    const company = { ...data };
    
    if (company.employeeSizeUserProvided) {
      company.employeeSize = `${company.employeeSize} (from CSV)`;
    }

    console.log(`Industry: ${data.industry}`);
    console.log(`Industry Evidence: ${data.industryEvidence}`);
    console.log(`Industry Inferred: ${data.industryInferred}`);
    console.log(`Location Evidence: ${data.locationEvidence}`);
    console.log(`Location Evidence Type: ${data.locationEvidenceType}`);
    
    console.log(`Rejected Fields: ${JSON.stringify(data._diagnostics?.rejectedFields || [])}`);
    console.log(`Tokens Used: ${data._diagnostics?.tokens || 'N/A'}`);
    
    const icp = {
      industries: ['SaaS', 'FinTech'],
      employeeMin: 200,
      employeeMax: 5000,
      locations: [],
      techStack: ['react', 'typescript', 'kubernetes', 'postgresql']
    };
    
    console.log('\n--- FULL SCORING JSON ---');
    console.log(JSON.stringify(scoreCompany(company, icp), null, 2));
    
  } catch (err) {
    console.error(`Error processing ${domain}:`, err.response?.data || err.message);
  }
}

run();
