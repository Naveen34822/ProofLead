import axios from 'axios';

async function run() {
  const domains = [
    { domain: 'loom.com', website: 'https://www.loom.com' },
    { domain: 'notion.so', website: 'https://www.notion.so' },
    { domain: 'stripe.com', website: 'https://www.stripe.com' }
  ];

  for (const { domain, website } of domains) {
    try {
      console.log(`\n================ Processing ${domain} ================`);
      const res = await axios.post('http://localhost:3001/api/enrich', {
        domain,
        website,
        forceRefresh: true
      });

      const data = res.data;
      
      console.log(`Industry: ${data.industry}`);
      console.log(`Industry Evidence: ${data.industryEvidence}`);
      console.log(`Industry Inferred: ${data.industryInferred}`);
      console.log(`Location Evidence: ${data.locationEvidence}`);
      console.log(`Location Evidence Type: ${data.locationEvidenceType}`);
      console.log(`Rejected Fields: ${JSON.stringify(data.rejectedFields || [])}`);
      console.log(`Tokens Used: ${JSON.stringify(data._diagnostics?.tokens || 'N/A')}`);
    } catch (err) {
      console.error(`Error processing ${domain}:`, err.response?.data || err.message);
    }
  }
}

run();
