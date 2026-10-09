export default function EnrichingOverlay({ progress }) {
  const { current, total, name } = progress;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="enriching-overlay">
      <div className="enriching-card animate-in">
        <div className="enriching-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <h2 className="enriching-title">Enriching & Scoring Leads</h2>
        <p className="enriching-subtitle">
          Analyzing company data, extracting growth signals, and calculating fit scores...
        </p>
        <div className="enriching-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <p className="enriching-status">
          {current > 0 ? (
            <>Processing {current} of {total} — {name}</>
          ) : (
            <>Initializing enrichment pipeline...</>
          )}
        </p>
      </div>
    </div>
  );
}
