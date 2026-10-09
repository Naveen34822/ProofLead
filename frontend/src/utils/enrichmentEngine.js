/**
 * ProofLead Enrichment Engine
 */

export async function enrichCompany(input) {
  const domain = (input.domain || '').toLowerCase().replace(/^www\./, '');
  
  let res;
  try {
    res = await fetch('/api/enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ domain, website: input.website })
    });
    
    if (!res.ok) {
      throw new Error(`Enrichment failed with status ${res.status}`);
    }
    
    const data = await res.json();
    
    // Fallback to CSV data if API data is missing/unknown
    if (!data.industry || data.industry === 'unknown') {
      if (input.industry) {
        data.industry = input.industry;
        data.industryUserProvided = true; // Signals UI to show 'from CSV'
      }
    }
    
    if (!data.employeeSize || data.employeeSize === 'unknown') {
      if (input.employees) {
        data.employeeSize = String(input.employees);
        data.employeeSizeUserProvided = true; // Signals UI to show 'from CSV'
      }
    }
    
    if (input.employees) data.csvEmployees = String(input.employees);
    if (input.industry) data.csvIndustry = input.industry;
    
    return {
      name: input.name || domain.split('.')[0],
      domain: domain,
      ...data
    };
  } catch (err) {
    let errorMsg = err.message;
    if (res && res.status >= 400) {
      try {
        const text = await res.text();
        const parsed = JSON.parse(text);
        if (parsed.error) errorMsg = parsed.error;
        else errorMsg = text;
      } catch (e) {
        errorMsg = res.statusText;
      }
    }

    console.warn(`Live enrichment failed for ${domain}:`, errorMsg);
    
    return {
      name: input.name || domain.split('.')[0],
      domain: domain,
      enrichmentStatus: 'failed',
      errorMessage: typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg,
      confidence: 'failed',
      score: 0 // Assign 0 score explicitly so it sorts to bottom
    };
  }
}

export async function enrichBatch(companies, onProgress) {
  const results = [];
  let currentCount = 0;

  const processCompany = async (company) => {
    const enriched = await enrichCompany(company);
    results.push(enriched);
    currentCount++;
    if (onProgress) onProgress(currentCount, companies.length, enriched.name);
  };

  const concurrencyLimit = 3;
  let i = 0;
  const execNext = async () => {
    while (i < companies.length) {
      const next = companies[i++];
      await processCompany(next);
    }
  };

  await Promise.all(Array.from({ length: concurrencyLimit }).map(() => execNext()));
  return results;
}
