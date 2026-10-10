/**
 * ProofLead Lead Scoring Engine
 * 
 * Scores each company against the user's Ideal Customer Profile (ICP).
 * Returns a score 0-100, breakdown factors, a human-readable reason,
 * an outreach suggestion, based ONLY on LLM extracted data.
 */

const categoryMap = {
  'developer platform': 'devtools',
  'developer tools': 'devtools',
  'devtools': 'devtools',
  'api': 'devtools',
  'subscription billing': 'fintech',
  'billing': 'fintech',
  'payments': 'fintech',
  'fintech': 'fintech',
  'saas': 'saas',
  'software': 'saas',
  'b2b software': 'saas',
  'cloud': 'cloud',
  'infrastructure': 'cloud',
  'cybersecurity': 'security',
  'security': 'security',
  'ai': 'ai',
  'artificial intelligence': 'ai',
  'machine learning': 'ai'
};

function getIndustryCategories(ind) {
  if (!ind) return [];
  let lower = ind.toLowerCase();
  let cats = new Set([lower]);
  
  lower.split(/[\/\-,]+/).forEach(p => cats.add(p.trim()));
  
  for (const [key, val] of Object.entries(categoryMap)) {
    if (lower.includes(key)) cats.add(val);
  }
  return Array.from(cats);
}

function industryMatchScore(companyIndustry, targetIndustries) {
  if (!targetIndustries || targetIndustries.length === 0) return { score: 100, matched: true };
  if (!companyIndustry || companyIndustry === 'unknown') return { score: 30, matched: false };
  
  const companyCats = getIndustryCategories(companyIndustry);
  
  for (const target of targetIndustries) {
    const targetCats = getIndustryCategories(target);
    for (const cCat of companyCats) {
      for (const tCat of targetCats) {
        if (cCat === tCat || cCat.includes(tCat) || tCat.includes(cCat)) {
          return { score: 100, matched: true };
        }
      }
    }
  }
  return { score: 0, matched: false };
}

function parseEmployeeRange(range) {
  if (!range || range === 'unknown') return { min: 0, max: 0 };
  const cleaned = range.replace(/[,+]/g, '').trim();
  const parts = cleaned.match(/\d+/g);
  if (!parts) return { min: 0, max: 0 };
  const nums = parts.map(Number);
  if (nums.length >= 2) return { min: nums[0], max: nums[1] };
  if (nums.length === 1) return { min: nums[0], max: nums[0] * 1.5 };
  return { min: 0, max: 0 };
}

function employeeSizeScore(companyRange, targetMin, targetMax) {
  if (!targetMin && !targetMax) return 100;
  if (!companyRange || companyRange === 'unknown') return 30;
  
  const { min: cMin, max: cMax } = parseEmployeeRange(companyRange);
  if (cMin === 0 && cMax === 0) return 30;
  
  const midpoint = (cMin + cMax) / 2;
  if (midpoint >= targetMin && midpoint <= targetMax) return 100;
  
  if (midpoint < targetMin) {
    const ratio = midpoint / targetMin;
    return Math.max(0, Math.round(ratio * 60));
  }
  if (midpoint > targetMax) {
    const ratio = targetMax / midpoint;
    return Math.max(0, Math.round(ratio * 60));
  }
  return 0;
}

function locationScore(companyLocation, targetLocations) {
  if (!targetLocations || targetLocations.length === 0) return 100;
  if (!companyLocation || companyLocation === 'unknown') return 30;
  
  const cLoc = companyLocation.toLowerCase();
  for (const loc of targetLocations) {
    if (cLoc.includes(loc.toLowerCase())) return 100;
  }
  return 0;
}

function techScore(companyTech, targetTech) {
  if (!targetTech || targetTech.length === 0) return 70;
  if (!companyTech || companyTech.length === 0) return 30;
  
  const matches = companyTech.filter(t => {
    const techStr = typeof t === 'object' ? t.tech : t;
    return targetTech.some(tt => techStr.toLowerCase().includes(tt.toLowerCase()) || tt.toLowerCase().includes(techStr.toLowerCase()));
  });
  if (matches.length === 0) return 20;
  return Math.min(40 + (matches.length / Math.max(targetTech.length, 1)) * 60, 100);
}

function hiringScore(hiringSignals) {
  return hiringSignals ? 100 : 30;
}

export function scoreCompany(company, icp) {
  if ((!company.industry || company.industry === 'unknown') && company.csvIndustry) {
    company.industry = company.csvIndustry;
    company.industryUserProvided = true;
  }
  if ((!company.employeeSize || company.employeeSize === 'unknown') && company.csvEmployees) {
    company.employeeSize = company.csvEmployees.toString();
    company.employeeSizeUserProvided = true;
  }
  if ((!company.location || company.location === 'unknown') && company.csvLocation) {
    company.location = company.csvLocation;
    company.locationUserProvided = true;
  }

  const factors = {};
  let validSignals = 0;
  let totalWeights = 0;
  let rawScore = 0;
  const hasLocationTarget = icp.locations && icp.locations.length > 0;
  let TOTAL_SIGNALS = hasLocationTarget ? 5 : 4;
  
  const wInd = hasLocationTarget ? 0.30 : 0.35;
  const wSize = hasLocationTarget ? 0.20 : 0.25;
  const wLoc = hasLocationTarget ? 0.20 : 0;
  const wHire = hasLocationTarget ? 0.20 : 0.25;
  const wTech = hasLocationTarget ? 0.10 : 0.15;

  const hasIndustry = company.industry && company.industry !== 'unknown';
  const hasBusinessModel = company.businessModel && company.businessModel !== 'unknown';

  if (hasIndustry || hasBusinessModel) {
    validSignals++;
    
    let indScore = 0;
    if (hasIndustry) {
      indScore = industryMatchScore(company.industry, icp.industries).score;
    }
    if (hasBusinessModel && icp.industries && icp.industries.some(i => i.toLowerCase() === company.businessModel.toLowerCase())) {
      indScore = 100;
    }
    
    factors.industry = { score: indScore, weight: wInd, label: 'Industry/Model Match' };
  } else {
    factors.industry = { score: 0, weight: wInd, label: 'Industry Match (Unknown)' };
  }
  
  if (company.employeeSize && company.employeeSize !== 'unknown') {
    validSignals++;
    factors.size = { score: employeeSizeScore(company.employeeSize, icp.employeeMin, icp.employeeMax), weight: wSize, label: 'Company Size' };
  } else {
    factors.size = { score: 0, weight: wSize, label: 'Company Size (Unknown)' };
  }

  if (hasLocationTarget) {
    if (company.location && company.location !== 'unknown') {
      validSignals++;
      factors.location = { score: locationScore(company.location, icp.locations), weight: wLoc, label: 'Location' };
    } else {
      factors.location = { score: 0, weight: wLoc, label: 'Location (Unknown)' };
    }
  } else {
    factors.location = { score: 0, weight: 0, label: 'Location (Excluded)' };
  }
  
  if (company.hiringSignals !== undefined && company.hiringSignals !== null && company.hiringSignals !== 'unknown') {
    if (company.hiringSignals || company.hiringSignalsEvidence !== 'unknown') {
      validSignals++;
      factors.hiring = { score: hiringScore(company.hiringSignals), weight: wHire, label: 'Hiring Signals' };
    } else {
      factors.hiring = { score: 0, weight: wHire, label: 'Hiring Signals (Unknown)' };
    }
  } else {
    factors.hiring = { score: 0, weight: wHire, label: 'Hiring Signals (Unknown)' };
  }
  
  if (company.techSignals && company.techSignals.length > 0) {
    validSignals++;
    factors.tech = { score: techScore(company.techSignals, icp.techStack), weight: wTech, label: 'Tech Match' };
  } else {
    factors.tech = { score: 0, weight: wTech, label: 'Tech Match (Unknown)' };
  }
  
  let totalScore = 0;
  
  if (validSignals === 0) {
    return {
      score: 0,
      factors,
      reason: 'Insufficient data',
      outreach: '',
      isInsufficient: true
    };
  }

  for (const key in factors) {
    if (factors[key].weight > 0) {
      // No renormalization: absolute sum
      const points = factors[key].score * factors[key].weight;
      factors[key].points = Math.round(points);
      totalScore += points;
    } else {
      factors[key].points = 0;
    }
  }
  
  totalScore = Math.round(totalScore);
  rawScore = totalScore;
  
  // Cap score by signal coverage
  if (validSignals === 1) {
    totalScore = Math.min(totalScore, 40);
  } else if (validSignals === 2) {
    totalScore = Math.min(totalScore, 65);
  } else if (validSignals === 3) {
    totalScore = Math.min(totalScore, 80);
  }
  
  // High priority (75+) requires at least 4 known signals including size, and Medium/High confidence
  if (totalScore >= 75) {
    const hasSize = factors.size && factors.size.weight > 0;
    if (validSignals < 4 || !hasSize || company.confidence === 'low' || company.confidence === 'failed') {
      totalScore = 74;
    }
  }

  const reason = generateReason(company, factors, totalScore, icp) + ` (based on ${validSignals} of ${TOTAL_SIGNALS} signals)`;
  const outreach = generateOutreach(company, factors, totalScore);
  
  return {
    score: totalScore,
    rawScore,
    validSignals,
    totalSignals: TOTAL_SIGNALS,
    factors,
    reason,
    outreach,
    isInsufficient: false
  };
}

function generateReason(company, factors, score, icp) {
  if (company.enrichmentStatus === 'failed') return 'Enrichment failed';

  const parts = [];
  
  if (factors.industry && factors.industry.weight > 0 && company.industry !== 'unknown') {
    if (factors.industry.score >= 80) {
      parts.push(`Industry matched (${company.industry})`);
    } else {
      const target = (icp.industries || []).join(', ') || '?';
      parts.push(`Industry mismatch (target: ${target}, found: ${company.industry})`);
    }
  }
  
  if (factors.size && factors.size.weight > 0 && company.employeeSize !== 'unknown') {
    if (factors.size.score >= 80) parts.push(`Size matched (${company.employeeSize})`);
    else parts.push(`Size partial (${company.employeeSize})`);
  }
  
  if (factors.location && factors.location.weight > 0 && factors.location.label !== 'Location (Excluded)' && company.location !== 'unknown') {
    if (factors.location.score >= 80) parts.push(`Location matched (${company.location})`);
    else parts.push(`Location mismatch (${company.location})`);
  }
  
  const isHiringKnown = company.hiringSignals !== undefined && company.hiringSignals !== null && company.hiringSignals !== 'unknown';
  if (factors.hiring && factors.hiring.weight > 0 && isHiringKnown) {
    if (company.hiringSignals === true || company.hiringSignals === 'true') {
      const count = company.hiringJobCount ? ` (${company.hiringJobCount})` : '';
      parts.push(`Hiring active${count}`);
    } else {
      parts.push(`Hiring not active`);
    }
  }
  
  const isTechKnown = company.techSignals && Array.isArray(company.techSignals) && company.techSignals.length > 0;
  if (factors.tech && factors.tech.weight > 0 && isTechKnown) {
    const techList = company.techSignals.map(t => typeof t === 'object' ? t.tech : t).join(', ');
    if (factors.tech.score >= 70) parts.push(`Tech matches (${techList})`);
    else parts.push(`Tech partial (${techList})`);
  }
  
  if (parts.length === 0) return 'Insufficient data.';
  
  return parts.join(', ') + '.';
}

function generateOutreach(company, factors, score) {
  if (score < 50) return `Park for now. Low priority lead based on extracted data.`;
  
  const knownInd = company.industry && company.industry !== 'unknown';
  const knownSize = company.employeeSize && company.employeeSize !== 'unknown';
  const isHiringKnown = company.hiringSignals !== undefined && company.hiringSignals !== null && company.hiringSignals !== 'unknown';
  const isHiringActive = isHiringKnown && (company.hiringSignals === true || company.hiringSignals === 'true');
  
  let angle = '';
  
  if (isHiringActive) {
    angle = `Since they are actively hiring, pitch how your solution accelerates onboarding and supports scaling teams`;
  } else if (knownSize) {
    angle = `Focus your messaging on driving ROI and operational efficiency for a team of ${company.employeeSize}`;
  } else {
    angle = `Focus your messaging on core value propositions for their current growth stage`;
  }
  
  if (knownInd) {
    angle += ` within the ${company.industry} space.`;
  } else {
    angle += `.`;
  }
  
  if (score >= 75) {
    return `${company.name || company.csvName || company.domain || 'This company'} is a high-priority target. ${angle}`;
  }
  return `${company.name || company.csvName || company.domain || 'This company'} is a moderate fit. Nurture this lead: ${angle}`;
}

export function scoreAndRankLeads(companies, icp) {
  const seen = new Set();
  const unique = [];
  
  for (const company of companies) {
    const domain = (company.domain || '').toLowerCase().replace(/^www\./, '');
    if (domain && seen.has(domain)) continue;
    if (domain) seen.add(domain);
    unique.push(company);
  }
  
  const scored = unique.map(company => ({
    ...company,
    ...scoreCompany(company, icp),
    status: 'new'
  }));
  
  scored.sort((a, b) => {
    if (a.isInsufficient && !b.isInsufficient) return 1;
    if (!a.isInsufficient && b.isInsufficient) return -1;
    return b.score - a.score;
  });
  
  scored.forEach((item, i) => {
    item.rank = i + 1;
    if (!item.totalSignals) item.totalSignals = (icp.locations && icp.locations.length > 0) ? 5 : 4;
  });
  
  const validLeads = scored.filter(l => l.enrichmentStatus !== 'failed' && !l.isInsufficient);
  
  return {
    leads: scored,
    stats: {
      total: scored.filter(l => l.enrichmentStatus !== 'failed').length, // Keep total non-failed
      duplicatesRemoved: companies.length - unique.length,
      highPriority: validLeads.filter(l => l.score >= 75).length,
      mediumPriority: validLeads.filter(l => l.score >= 50 && l.score < 75).length,
      lowPriority: validLeads.filter(l => l.score < 50).length,
      needsData: scored.filter(l => l.isInsufficient).length,
      avgScore: validLeads.length > 0 ? Math.round(validLeads.reduce((s, l) => s + l.score, 0) / validLeads.length) : 0
    }
  };
}

export function leadsToCSV(leads) {
  const headers = [
    'Rank', 'Company', 'Domain', 'Score', 'Confidence',
    'Industry', 'Industry Evidence', 'Employees', 'Size Evidence',
    'Location', 'Location Evidence',
    'Hiring', 'Hiring Evidence', 'Tech Stack',
    'Reason', 'Outreach Suggestion', 'Status'
  ];
  
  const rows = leads.map(lead => [
    lead.rank,
    `"${(lead.name || '').replace(/"/g, '""')}"`,
    lead.domain,
    lead.score,
    lead.confidence || 'unknown',
    `"${(lead.industry || '').replace(/"/g, '""')}"`,
    `"${(lead.industryEvidence || '').replace(/"/g, '""')}"`,
    `"${(lead.employeeSize || '').replace(/"/g, '""')}"`,
    `"${(lead.employeeSizeEvidence || '').replace(/"/g, '""')}"`,
    `"${(lead.location || '').replace(/"/g, '""')}"`,
    `"${(lead.locationEvidence || '').replace(/"/g, '""')}"`,
    lead.atsDetected === null ? 'Not found' : (lead.hiringJobCount === 0 ? 'Not hiring' : 'Yes'),
    `"${(lead.atsDetected && lead.hiringJobCount > 0 ? `${lead.hiringJobCount} open roles via ${lead.atsDetected} (${(() => { try { const u = new URL(lead.hiringSignalsEvidence); const p = u.pathname.split('/'); return u.hostname + (p.length > 1 ? '/' + p[1] : ''); } catch(e) { return lead.hiringSignalsEvidence; } })()})` : lead.hiringSignalsEvidence || '').replace(/"/g, '""')}"`, 
    `"${(lead.techSignals || []).map(t => typeof t === 'object' ? `${t.tech} (${t.count}/${t.totalRoles})` : t).join('; ').replace(/"/g, '""')}"`,
    `"${(lead.reason || '').replace(/"/g, '""')}"`,
    `"${(lead.outreach || '').replace(/"/g, '""')}"`,
    lead.status || 'new'
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}
