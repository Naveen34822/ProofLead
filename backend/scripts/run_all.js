import axios from 'axios';
import fs from 'fs';

async function run() {
  const csvData = fs.readFileSync('/Users/naveen/Desktop/Caprae_Capital/20_enriched_test_leads.csv', 'utf8');
  const lines = csvData.split('\n').filter(l => l.trim());
  const header = lines[0].split(',').map(h => h.trim());
  const domains = lines.slice(1).map(l => {
    const parts = l.split(',');
    return { domain: parts[1].trim(), website: parts[2].trim() };
  });

  const results = [];
  const concurrencyLimit = 3;
  let index = 0;

  const worker = async () => {
    while (index < domains.length) {
      const { domain, website } = domains[index++];
      try {
        console.log(`Processing ${domain}...`);
        const res = await axios.post('http://localhost:3001/api/enrich', {
          domain,
          website,
          forceRefresh: true
        });

        const data = res.data;
        const signalsCount = (data.industry && data.industry !== 'unknown' ? 1 : 0) +
          (data.employeeSize && data.employeeSize !== 'unknown' ? 1 : 0) +
          (data.techSignals && data.techSignals.length > 0 ? 1 : 0) +
          (data.location && data.location !== 'unknown' ? 1 : 0) +
          (data.hiringJobCount > 0 ? 1 : 0);

        results.push({
          domain,
          status: data.enrichmentStatus || 'unknown',
          reason: data.failedReason || data.blockedReason || '',
          source: data.enrichmentSource || 'live',
          confidence: data.confidence || 'none',
          signals: `${signalsCount}/5`,
          tokens: data._diagnostics?.tokens || 'N/A' // assuming we could print token usage if available
        });
      } catch (err) {
        results.push({
          domain,
          status: 'error',
          reason: err.response?.data?.error || err.message,
          source: 'error',
          confidence: 'none',
          signals: '0/5',
          tokens: 'N/A'
        });
      }
    }
  };

  const workers = Array.from({ length: concurrencyLimit }).map(() => worker());
  await Promise.all(workers);

  console.table(results);
}

run();
