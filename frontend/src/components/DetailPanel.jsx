import { useState, useEffect } from 'react';
import { formatHiring } from '../utils/formatters';

function ScoreRing({ score, size = 120 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg>
        <circle className="score-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="score-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-ring-value" style={{ color }}>
        {score}
        <span className="score-ring-label">/ 100</span>
      </div>
    </div>
  );
}

function ScoreFactor({ label, score, points, color }) {
  const isUnknown = label.includes('(Unknown)');
  const title = isUnknown ? label.replace(' (Unknown)', '') : label;
  const displayValue = isUnknown ? 'Not scored (unknown)' : (points !== undefined ? `+${points} pts` : `${score}%`);
  const barColor = isUnknown ? 'var(--border-color)' : (color || 'var(--accent-primary)');

  return (
    <div className="score-factor">
      <div className="score-factor-header">
        <span className="score-factor-label">{title}</span>
        <span className="score-factor-value" style={{ color: isUnknown ? 'var(--text-muted)' : color }}>{displayValue}</span>
      </div>
      <div className="score-factor-bar" style={{ background: isUnknown ? 'transparent' : 'var(--bg-tertiary)', border: isUnknown ? '1px dashed var(--border-color)' : 'none' }}>
        <div
          className="score-factor-fill"
          style={{
            width: isUnknown ? '100%' : `${score}%`,
            background: barColor,
            opacity: isUnknown ? 0.5 : 1
          }}
        />
      </div>
    </div>
  );
}

export default function DetailPanel({ lead, onClose, onStatusChange }) {
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    setAnimateIn(true);
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!lead) return null;

  const factors = lead.factors || {};
  const factorColor = (score) =>
    score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-panel">
        {/* Header */}
        <div className="detail-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <div className="company-avatar" style={{ width: 44, height: 44, fontSize: '1.1rem' }}>
                {(lead.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{lead.name}</h2>
                <a
                  href={lead.website || `https://${lead.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--accent-primary-hover)', textDecoration: 'none' }}
                >
                  {lead.domain} ↗
                </a>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="detail-body">
          {/* Score Ring */}
          <div className="detail-section" style={{ textAlign: 'center' }}>
            {lead.enrichmentStatus === 'blocked' ? (
              <div style={{ padding: '2rem 0', color: 'var(--danger)' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Blocked</div>
                <p>Status: {lead.blockedCode ? `Blocked (${lead.blockedCode})` : 'Blocked'}</p>
              </div>
            ) : lead.isInsufficient ? (
              <div style={{ padding: '2rem 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Insufficient Data</div>
                <p>Not enough signals to score</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <ScoreRing score={lead.score} />
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Lead Score — {lead.score >= 75 ? 'High Priority' : lead.score >= 50 ? 'Medium Priority' : 'Low Priority'}
                </p>
              </>
            )}
          </div>

          {/* Score Breakdown */}
          <div className="detail-section">
            <h3 className="detail-section-title">Score Breakdown</h3>
            {lead.rawScore !== undefined && lead.rawScore !== lead.score && (
              <p style={{ fontSize: '0.85rem', color: 'var(--warning)', marginBottom: '1rem' }}>
                Raw {lead.rawScore} → capped at {lead.score} ({lead.validSignals} of {lead.totalSignals || 5} signals known)
              </p>
            )}
            <div className="score-breakdown">
              {Object.entries(factors).map(([key, f]) => (
                <ScoreFactor
                  key={key}
                  label={f.label}
                  score={f.score}
                  points={f.points}
                  color={factorColor(f.score)}
                />
              ))}
            </div>
          </div>

          {/* Why This Lead */}
          <div className="detail-section">
            <h3 className="detail-section-title">💡 Why This Lead?</h3>
            <div className="reason-box">
              {lead.reason}
            </div>
          </div>

          {/* Outreach Suggestion */}
          {lead.outreach && (
            <div className="detail-section">
              <h3 className="detail-section-title">🎯 Outreach Suggestion</h3>
              <div className="outreach-box">
                {lead.outreach}
              </div>
            </div>
          )}

          {/* Company Details */}
          {lead.enrichmentStatus === 'failed' ? (
            <div className="detail-section" style={{ border: '1px solid var(--danger)', padding: '1rem', borderRadius: '8px' }}>
              <h3 style={{ color: 'var(--danger)', marginBottom: '0.5rem', fontSize: '1rem' }}>Enrichment Failed</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                {lead.errorMessage}
              </p>
            </div>
          ) : (
            <div className="detail-section">
              <h3 className="detail-section-title">Extracted Info</h3>
            
            <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.25rem' }}>
                <span className="detail-field-label">Industry</span>
                <span className="detail-field-value">
                  {lead.industry || 'unknown'}
                  {lead.industryUserProvided && <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '0.5rem' }}>(from CSV)</span>}
                </span>
              </div>
              {lead.industryEvidence && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', width: '100%', fontStyle: 'italic' }}>
                  "{lead.industryEvidence === 'unknown' ? 'Not found on fetched pages' : lead.industryEvidence}"
                </div>
              )}
            </div>

            <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.25rem' }}>
                <span className="detail-field-label">Employee Size</span>
                <span className="detail-field-value">
                  {lead.employeeSize || 'unknown'}
                  {lead.employeeSizeUserProvided && <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '0.5rem' }}>(from CSV)</span>}
                </span>
              </div>
              {lead.employeeSizeEvidence && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', width: '100%', fontStyle: 'italic' }}>
                  "{lead.employeeSizeEvidence === 'unknown' ? 'Not found on fetched pages' : lead.employeeSizeEvidence}"
                </div>
              )}
            </div>

            <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.25rem' }}>
                <span className="detail-field-label">Location</span>
                <span className="detail-field-value">
                  {lead.location || 'unknown'}
                  {lead.locationUserProvided && <span style={{ fontSize: '0.7rem', opacity: 0.6, marginLeft: '0.5rem' }}>(from CSV)</span>}
                </span>
              </div>
              {lead.locationEvidence && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', width: '100%', fontStyle: 'italic' }}>
                  "{lead.locationEvidence === 'unknown' ? 'Not found on fetched pages' : lead.locationEvidence}"
                  {lead.locationEvidenceType && lead.locationEvidenceType !== 'unknown' && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.65rem', fontStyle: 'normal', opacity: 0.8 }}>
                      Source: {lead.locationEvidenceType}
                    </div>
                  )}
                </div>
              )}
            </div>

            {lead.csvLinkedin && (
              <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.25rem' }}>
                  <span className="detail-field-label">LinkedIn</span>
                  <span className="detail-field-value">
                    <a href={lead.csvLinkedin} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary-hover)', textDecoration: 'none' }}>
                      View Profile ↗
                    </a>
                  </span>
                </div>
              </div>
            )}

            {lead.csvEmail && (
              <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.25rem' }}>
                  <span className="detail-field-label">Email</span>
                  <span className="detail-field-value">
                    <a href={`mailto:${lead.csvEmail}`} style={{ color: 'var(--accent-primary-hover)', textDecoration: 'none' }}>
                      {lead.csvEmail}
                    </a>
                  </span>
                </div>
              </div>
            )}

            <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '0.25rem' }}>
                <span className="detail-field-label">Hiring Signals</span>
                <span className="detail-field-value" style={{ color: lead.hiringJobCount > 0 ? 'var(--success)' : 'inherit' }}>
                  {lead.enrichmentStatus === 'blocked' || lead.enrichmentStatus === 'failed' ? '—' : formatHiring(lead.hiringSignals, lead.hiringJobCount)}
                </span>
              </div>
              {lead.hiringSignalsEvidence && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', width: '100%', fontStyle: 'italic' }}>
                  "{lead.hiringSignalsEvidence === 'unknown' ? 'Not found on fetched pages' : lead.hiringSignalsEvidence}"
                </div>
              )}
            </div>
            
            <div className="detail-field">
              <span className="detail-field-label">Confidence</span>
              <span className="detail-field-value">
                <span className={`confidence-indicator confidence-${lead.confidence}`}>
                  <span className="confidence-dot" />
                  {lead.confidence === 'high' ? 'High' : lead.confidence === 'medium' ? 'Medium' : 'Low'}
                </span>
              </span>
            </div>
          </div>
          )}

          {/* Tech Stack */}
          {lead.techSignals && lead.techSignals.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Tech Stack</h3>
              <div className="form-chips">
                {lead.techSignals.map((t, idx) => {
                  const techName = typeof t === 'object' ? t.tech : t;
                  const countLabel = typeof t === 'object' && t.source === 'ats' && t.count > 0 ? ` (${t.count}/${t.totalRoles})` : '';
                  return <span key={techName + idx} className="chip">{techName}{countLabel}</span>;
                })}
              </div>
              {lead.techSignalsEvidence && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: '4px', width: '100%', fontStyle: 'italic', marginTop: '0.5rem' }}>
                  "{lead.techSignalsEvidence === 'unknown' ? 'Not found on fetched pages' : lead.techSignalsEvidence}"
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          {(lead.textLength || lead.sources) && (
            <div className="detail-section">
              <h3 className="detail-section-title">Enrichment Metadata</h3>
              
              {lead.textLength && (
                <div className="detail-field">
                  <span className="detail-field-label">Fetched Text Length</span>
                  <span className="detail-field-value">{lead.textLength.toLocaleString()} chars</span>
                </div>
              )}
              
              {lead.sources && (
                <div className="detail-field" style={{ flexDirection: 'column', alignItems: 'flex-start', borderBottom: 'none' }}>
                  <span className="detail-field-label" style={{ marginBottom: '0.25rem' }}>Scraped URLs</span>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', wordBreak: 'break-all' }}>
                    {lead.sources.home && <div><span style={{color: 'var(--text-muted)'}}>[Home]</span> <a href={lead.sources.home} target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary-hover)', textDecoration: 'none'}}>{lead.sources.home}</a></div>}
                    {lead.sources.about && <div><span style={{color: 'var(--text-muted)'}}>[About]</span> <a href={lead.sources.about} target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary-hover)', textDecoration: 'none'}}>{lead.sources.about}</a></div>}
                    {lead.sources.careers && <div><span style={{color: 'var(--text-muted)'}}>[Careers]</span> <a href={lead.sources.careers} target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary-hover)', textDecoration: 'none'}}>{lead.sources.careers}</a></div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status Actions */}
          <div className="detail-section" style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
            <h3 className="detail-section-title">Actions</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className={`btn ${lead.status === 'new' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => onStatusChange(lead.domain, 'new')}
              >
                ● New
              </button>
              <button
                className={`btn ${lead.status === 'contacted' ? 'btn-success' : 'btn-secondary'} btn-sm`}
                onClick={() => onStatusChange(lead.domain, 'contacted')}
              >
                ● Contacted
              </button>
              <button
                className={`btn ${lead.status === 'skip' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                onClick={() => onStatusChange(lead.domain, 'skip')}
              >
                ● Skip
              </button>
            </div>
            
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Export for CRM</span>
              <button
                className="btn btn-primary btn-sm"
                disabled={lead.enrichmentStatus === 'failed'}
                onClick={() => {
                  const headers = ['Name', 'Company Domain Name', 'Industry', 'Number of Employees', 'City', 'Country/Region', 'LinkedIn Company Page', 'Lead Status', 'Lead Score'];
                  let city = '';
                  let country = '';
                  if (lead.location && lead.location !== 'unknown') {
                    const locParts = lead.location.split(',');
                    if (locParts.length > 1) {
                      city = locParts[0].trim();
                      country = locParts[1].trim();
                    } else {
                      city = lead.location;
                    }
                  }
                  
                  let employeeNum = '';
                  if (lead.employeeSize && lead.employeeSize !== 'unknown') {
                    const match = String(lead.employeeSize).replace(/,/g, '').match(/\\d+/);
                    if (match) employeeNum = match[0];
                  }
                  
                  let mappedIndustry = '';
                  const hsMap = {
                    'SaaS': 'Computer Software',
                    'FinTech': 'Financial Services',
                    'HealthTech': 'Hospital & Health Care',
                    'EdTech': 'Education Management',
                    'MarTech': 'Marketing and Advertising',
                    'DevTools': 'Computer Software',
                    'Cybersecurity': 'Computer & Network Security',
                    'HR Tech': 'Human Resources',
                    'E-commerce': 'Internet',
                    'Cloud Infrastructure': 'Information Technology and Services',
                    'AI/ML': 'Information Technology and Services',
                    'Analytics': 'Information Technology and Services',
                    'Communication': 'Telecommunications',
                    'Productivity': 'Computer Software'
                  };
                  if (lead.industry && lead.industry !== 'unknown') {
                    mappedIndustry = hsMap[lead.industry] || '';
                  }
                  
                  const row = [
                    `"${(lead.name || '').replace(/"/g, '""')}"`,
                    lead.domain,
                    `"${mappedIndustry}"`,
                    employeeNum,
                    `"${city.replace(/"/g, '""')}"`,
                    `"${country.replace(/"/g, '""')}"`,
                    lead.csvLinkedin || '',
                    lead.status || 'NEW',
                    lead.score || 0
                  ];
                  
                  const csvContent = headers.join(',') + '\n' + row.join(',');
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `hubspot-import-${lead.domain}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                Export for HubSpot (CSV)
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
