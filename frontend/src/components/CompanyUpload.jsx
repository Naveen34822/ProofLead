import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';

export default function CompanyUpload({ onSubmit, onUseSample, onBack }) {
  const [companies, setCompanies] = useState([]);
  const [pasteText, setPasteText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef(null);

  const parseCSV = useCallback((text) => {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
    });

    const parsed = result.data
      .map(row => {
        const domain = (row.domain || row.website || row.url || '')
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/.*$/, '');
        
        return {
          name: row.name || row.company || row.company_name || '',
          domain,
          website: row.website || row.url || (domain ? `https://${domain}` : ''),
          csvEmployees: row.employees || row.size || row.employee_size || null,
          csvLocation: row.location || row.headquarters || null,
          csvIndustry: row.industry || null,
          csvLinkedin: row.linkedin || row.linkedin_url || null,
          csvEmail: row.email || row.contact_email || null,
        };
      })
      .filter(c => c.name || c.domain);

    const uniqueMap = new Map();
    parsed.forEach(c => {
      const key = c.domain || c.name;
      if (key && !uniqueMap.has(key)) uniqueMap.set(key, c);
    });
    
    return Array.from(uniqueMap.values());
  }, []);

  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      setCompanies(parsed);
    };
    reader.readAsText(file);
  }, [parseCSV]);

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;

    // Check if it looks like CSV
    if (pasteText.includes(',') && pasteText.includes('\n')) {
      const parsed = parseCSV(pasteText);
      setCompanies(parsed);
    } else {
      // Treat as list of domains/URLs, one per line
      const lines = pasteText.split('\n').filter(l => l.trim());
      const parsed = lines.map(line => {
        const cleaned = line.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        return {
          name: cleaned.split('.')[0],
          domain: cleaned,
          website: `https://${cleaned}`,
        };
      });
      setCompanies(parsed);
    }
  }, [pasteText, parseCSV]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const removeCompany = useCallback((index) => {
    setCompanies(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="animate-in">
      {/* Hero */}
      <div className="hero-section">
        <div className="hero-badge">
          <span>📋</span> Step 2 of 3
        </div>
        <h1 className="hero-title">
          Add Your <span>Companies</span>
        </h1>
        <p className="hero-subtitle">
          Upload a CSV, paste URLs, or use our sample dataset.
          We'll enrich each company and score them against your ICP.
        </p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Upload Zone */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div
            className={`upload-zone ${dragOver ? 'dragover' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="upload-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="upload-title">
              {fileName ? `📄 ${fileName}` : 'Drop CSV file here or click to browse'}
            </p>
            <p className="upload-subtitle">
              CSV should have columns: name, domain (or website)
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload(e.target.files[0])}
          />
        </div>

        {/* OR divider */}
        <div className="upload-or">or paste domains/URLs</div>

        {/* Paste zone */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <textarea
            className="form-textarea"
            placeholder={`Paste company domains or URLs (one per line):

freshworks.com
chargebee.com
postman.com

Or paste CSV content with headers:
name,domain,website
Freshworks,freshworks.com,https://freshworks.com`}
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            style={{ minHeight: 140 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
            <button
              className="btn btn-secondary"
              onClick={handlePaste}
              disabled={!pasteText.trim()}
            >
              Parse Input
            </button>
          </div>
        </div>

        {/* OR divider */}
        <div className="upload-or">or use sample data</div>

        {/* Sample data button */}
        <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Don't have data handy? Use our curated list of <strong style={{ color: 'var(--text-primary)' }}>30 real SaaS companies</strong> to see the tool in action.
          </p>
          <button className="btn btn-primary" onClick={onUseSample}>
            🚀 Use Sample Dataset (30 companies)
          </button>
        </div>

        {/* Parsed companies preview */}
        {companies.length > 0 && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <div>
                <h2 className="card-title">Parsed Companies ({companies.length})</h2>
                <p className="card-subtitle">Review before enrichment</p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setCompanies([]); setFileName(''); }}
              >
                Clear All
              </button>
            </div>
            <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Company</th>
                    <th>Domain</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{c.name || '—'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{c.domain}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => removeCompany(i)}
                          style={{ color: 'var(--danger)', padding: '0.2rem 0.5rem' }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={onBack}>
            ← Back to ICP
          </button>
          {companies.length > 0 && (
            <button
              className="btn btn-primary btn-lg"
              onClick={() => onSubmit(companies)}
            >
              Enrich & Score {companies.length} Companies →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
