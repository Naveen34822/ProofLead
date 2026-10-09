import { useState, useMemo, useCallback } from 'react';
import { formatHiring } from '../utils/formatters';

function ScoreBadge({ score }) {
  const cls = score >= 75 ? 'score-high' : score >= 50 ? 'score-medium' : 'score-low';
  return <span className={`score-badge ${cls}`}>{score}</span>;
}

function StatusTag({ status, domain, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const statusMap = {
    new: { cls: 'status-new', label: '● New' },
    contacted: { cls: 'status-contacted', label: '● Contacted' },
    skip: { cls: 'status-skip', label: '● Skip' },
  };
  const s = statusMap[status] || statusMap.new;

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={`status-tag ${s.cls}`}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        {s.label}
      </button>
      {open && (
        <div className="status-dropdown" onClick={(e) => e.stopPropagation()}>
          {Object.entries(statusMap).map(([key, val]) => (
            <button
              key={key}
              className="status-dropdown-item"
              onClick={() => { onStatusChange(domain, key); setOpen(false); }}
            >
              {val.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }) {
  const cls = `confidence-indicator confidence-${confidence}`;
  const label = confidence === 'high' ? 'High' : confidence === 'medium' ? 'Medium' : 'Low';
  return (
    <span className={cls}>
      <span className="confidence-dot" />
      {label}
    </span>
  );
}

export default function ResultsDashboard({ leads, stats, icp, onExport, onSelectLead, onStatusChange, onStartOver, onRetryFailed, onIcpChange }) {
  const [search, setSearch] = useState('');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [hiringFilter, setHiringFilter] = useState('all');
  const [excludeUnknowns, setExcludeUnknowns] = useState(false);
  const [sortField, setSortField] = useState('score');
  const [sortDir, setSortDir] = useState('desc');

  // Unique industries for filter
  const industries = useMemo(() => {
    const set = new Set(leads.map(l => l.industry).filter(Boolean));
    return Array.from(set).sort();
  }, [leads]);

  // Filtered & sorted leads
  const filtered = useMemo(() => {
    let result = [...leads];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        (l.name || '').toLowerCase().includes(q) ||
        (l.domain || '').toLowerCase().includes(q) ||
        (l.industry || '').toLowerCase().includes(q) ||
        (l.location || '').toLowerCase().includes(q)
      );
    }

    // Score filter
    if (scoreFilter === 'high') result = result.filter(l => l.score >= 75);
    else if (scoreFilter === 'medium') result = result.filter(l => l.score >= 50 && l.score < 75);
    else if (scoreFilter === 'low') result = result.filter(l => l.score < 50);

    // Status filter
    if (statusFilter !== 'all') result = result.filter(l => l.status === statusFilter);

    // Industry filter
    if (industryFilter !== 'all') result = result.filter(l => l.industry === industryFilter);

    // Confidence filter
    if (confidenceFilter !== 'all') result = result.filter(l => l.confidence === confidenceFilter || (confidenceFilter === 'high/medium' && (l.confidence === 'high' || l.confidence === 'medium')));

    // Hiring filter
    if (hiringFilter === 'yes') result = result.filter(l => l.hiringSignals === true);

    // Exclude unknowns filter
    if (excludeUnknowns) {
      result = result.filter(l => 
        l.industry !== 'unknown' && 
        l.employeeSize !== 'unknown' && 
        l.hiringSignals !== 'unknown' &&
        l.techSignals && l.techSignals.length > 0
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, search, scoreFilter, statusFilter, industryFilter, confidenceFilter, hiringFilter, excludeUnknowns, sortField, sortDir]);

  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }, [sortField]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="animate-in">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-card">
          <p className="stat-label">Total Leads</p>
          <p className="stat-value text-accent">{stats.total}</p>
          {stats.duplicatesRemoved > 0 && (
            <p className="stat-change">{stats.duplicatesRemoved} duplicates removed</p>
          )}
        </div>
        <div className="stat-card">
          <p className="stat-label">High Priority (75+)</p>
          <p className="stat-value text-success">{stats.highPriority}</p>
          <p className="stat-change">Ready for outreach</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Medium Priority</p>
          <p className="stat-value text-warning">{stats.mediumPriority}</p>
          <p className="stat-change">Nurture sequence</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Low Priority</p>
          <p className="stat-value text-danger">{stats.lowPriority}</p>
          <p className="stat-change">Park for now</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Needs More Data</p>
          <p className="stat-value" style={{ color: 'var(--text-muted)' }}>{stats.needsData || 0}</p>
          <p className="stat-change">Insufficient signals</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Average Score</p>
          <p className="stat-value" style={{ color: 'var(--text-primary)' }}>{stats.avgScore}</p>
          <p className="stat-change">Across all leads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-wrapper">
          <span className="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </span>
          <input
            type="text"
            className="filter-input"
            placeholder="Search companies, domains, industries..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <select className="filter-select" value={scoreFilter} onChange={e => setScoreFilter(e.target.value)}>
          <option value="all">All Scores</option>
          <option value="high">High (75+)</option>
          <option value="medium">Medium (50-74)</option>
          <option value="low">Low (&lt;50)</option>
        </select>
        <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="skip">Skip</option>
        </select>
        <select className="filter-select" value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}>
          <option value="all">All Industries</option>
          {industries.map(ind => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
        <select className="filter-select" value={confidenceFilter} onChange={e => setConfidenceFilter(e.target.value)}>
          <option value="all">All Confidence</option>
          <option value="high/medium">High/Medium</option>
          <option value="high">High Only</option>
        </select>
        <select className="filter-select" value={hiringFilter} onChange={e => setHiringFilter(e.target.value)}>
          <option value="all">Hiring: Any</option>
          <option value="yes">Hiring: Yes</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={excludeUnknowns} onChange={e => setExcludeUnknowns(e.target.checked)} />
          Hide leads with missing data
        </label>
        <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 0.5rem' }} />
        <select className="filter-select" style={{ background: 'var(--bg-card)', fontWeight: 600, color: 'var(--accent-primary-hover)' }} onChange={(e) => onIcpChange && onIcpChange(e.target.value)}>
          <option value="current">Current ICP</option>
          <option value="demo">Demo ICP (DevTools, 50-200)</option>
        </select>
      </div>

      {/* Results Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 50 }} onClick={() => handleSort('rank')} className={sortField === 'rank' ? 'sorted' : ''}>
                # <SortIcon field="rank" />
              </th>
              <th onClick={() => handleSort('name')} className={sortField === 'name' ? 'sorted' : ''}>
                Company <SortIcon field="name" />
              </th>
              <th onClick={() => handleSort('score')} className={sortField === 'score' ? 'sorted' : ''}>
                Score <SortIcon field="score" />
              </th>
              <th>Confidence</th>
              <th onClick={() => handleSort('industry')} className={sortField === 'industry' ? 'sorted' : ''}>
                Industry <SortIcon field="industry" />
              </th>
              <th>Employees</th>
              <th>Hiring</th>
              <th>Tech Stack</th>
              <th style={{ width: 60 }}>Signals</th>
              <th>Why This Lead?</th>
              <th style={{ width: 100 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <tr key={lead.domain} onClick={() => onSelectLead(lead)}>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {lead.rank}
                </td>
                <td>
                  <div className="company-info">
                    <div className="company-avatar">
                      {(lead.name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="company-name" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {lead.name}
                        {lead.usingCachedFrom && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.25rem' }}>
                            Cached · {new Date(lead.usingCachedFrom).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="company-domain">{lead.domain}</div>
                    </div>
                  </div>
                </td>
                <td>
                  {lead.enrichmentStatus === 'blocked' ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>{lead.blockedCode ? `Blocked (${lead.blockedCode})` : 'Blocked'}</span>
                  ) : lead.isInsufficient ? (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Insufficient data</span>
                  ) : (
                    <ScoreBadge score={lead.enrichmentStatus === 'failed' ? 0 : lead.score} />
                  )}
                </td>
                <td>
                  {lead.enrichmentStatus === 'blocked' ? (
                    <span className="confidence-indicator" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Blocked
                    </span>
                  ) : lead.enrichmentStatus === 'failed' ? (
                    <span className="confidence-indicator" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      Failed - Retry
                    </span>
                  ) : (
                    <ConfidenceBadge confidence={lead.confidence} />
                  )}
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '140px' }}>
                  {lead.enrichmentStatus === 'blocked' || lead.enrichmentStatus === 'failed' ? (
                    <span style={{ color: 'var(--danger)' }}>Error</span>
                  ) : (
                    <div style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'normal' }} title={lead.industry}>
                      {lead.industry || '—'}
                    </div>
                  )}
                  {lead.industryUserProvided && <span style={{ fontSize: '0.7rem', opacity: 0.6, display: 'block' }}>(from CSV)</span>}
                </td>
                <td style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                  {lead.employeeSize || '—'}
                  {lead.employeeSizeUserProvided && <span style={{ fontSize: '0.7rem', opacity: 0.6, display: 'block' }}>(from CSV)</span>}
                </td>
                <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  {lead.enrichmentStatus === 'blocked' || lead.enrichmentStatus === 'failed' ? (
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                  ) : (
                    <span style={{ color: lead.hiringJobCount > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {lead.hiringJobCount > 0 && '✓ '}{formatHiring(lead.hiringSignals, lead.hiringJobCount, lead.atsDetected)}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={(lead.techSignals || []).map(t => {
                    const tech = typeof t === 'object' ? t.tech : t;
                    const capTech = tech ? tech.charAt(0).toUpperCase() + tech.slice(1) : '';
                    return typeof t === 'object' && t.count ? `${capTech} (${t.count}/${t.totalRoles} roles)` : capTech;
                  }).join(', ')}>
                  {(lead.techSignals || []).map(t => {
                    const tech = typeof t === 'object' ? t.tech : t;
                    const capTech = tech ? tech.charAt(0).toUpperCase() + tech.slice(1) : '';
                    return typeof t === 'object' && t.count ? `${capTech} (${t.count}/${t.totalRoles} roles)` : capTech;
                  }).slice(0, 5).join(', ') || '—'}
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  {Object.values(lead.factors || {}).filter(f => f.score > 0 || (f.label && !f.label.includes('Unknown') && !f.label.includes('Excluded'))).length}/{lead.totalSignals || 5}
                </td>
                <td>
                  <div title={lead.reason} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'help', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {lead.reason}
                  </div>
                </td>
                <td>
                  <StatusTag
                    status={lead.status}
                    domain={lead.domain}
                    onStatusChange={onStatusChange}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h3 className="empty-title">No leads match your filters</h3>
          <p className="empty-subtitle">Try adjusting your search or filter criteria</p>
        </div>
      )}

      {/* Action Bar */}
      <div className="action-bar">
        <div className="action-bar-left">
          Showing {filtered.length} of {leads.length} leads
          {search && ` · Filtered by "${search}"`}
        </div>
        <div className="action-bar-right">
          {leads.some(l => l.enrichmentStatus === 'failed') && (
            <button className="btn btn-warning" onClick={onRetryFailed} style={{ marginRight: '8px' }}>
              🔄 Retry Failed
            </button>
          )}
          <button className="btn btn-secondary" onClick={onStartOver}>
            ↩ Start Over
          </button>
          <button className="btn btn-success" onClick={onExport}>
            📥 Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
