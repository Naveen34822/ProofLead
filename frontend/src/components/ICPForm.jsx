import { useState, useCallback } from 'react';

const INDUSTRY_PRESETS = [
  'SaaS', 'FinTech', 'HealthTech', 'EdTech', 'MarTech',
  'E-commerce', 'DevTools', 'Cybersecurity', 'HR Tech', 'AI/ML',
  'Cloud Infrastructure', 'Analytics', 'Communication', 'Productivity',
];

const TECH_PRESETS = [
  'React', 'Python', 'Node.js', 'AWS', 'GCP', 'Java', 'Go',
  'TypeScript', 'Kubernetes', 'PostgreSQL', 'MongoDB',
];

export default function ICPForm({ onSubmit, initialData }) {
  const [industries, setIndustries] = useState(initialData?.industries || []);
  const [customIndustry, setCustomIndustry] = useState('');
  const [employeeMin, setEmployeeMin] = useState(initialData?.employeeMin || '');
  const [employeeMax, setEmployeeMax] = useState(initialData?.employeeMax || '');
  const [locations, setLocations] = useState(initialData?.locations || []);
  const [customLocation, setCustomLocation] = useState('');
  const [techStack, setTechStack] = useState(initialData?.techStack || []);
  const [customTech, setCustomTech] = useState('');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const toggleChip = useCallback((list, setList, value) => {
    setList(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }, []);

  const addCustom = useCallback((value, list, setList, setInput) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList(prev => [...prev, trimmed]);
    }
    setInput('');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      industries,
      employeeMin: employeeMin ? Number(employeeMin) : 0,
      employeeMax: employeeMax ? Number(employeeMax) : 100000,
      locations,
      techStack,
      notes,
    });
  };

  const isValid = industries.length > 0;

  return (
    <div className="animate-in">
      {/* Hero */}
      <div className="hero-section">
        <div className="hero-badge">
          <span>🎯</span> Step 1 of 3
        </div>
        <h1 className="hero-title">
          Define Your <span>Ideal Customer</span>
        </h1>
        <p className="hero-subtitle">
          Tell us what your perfect customer looks like. We'll use this to score
          and rank every lead so your sales team focuses on the highest-value targets.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Target Industries */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">🏢 Target Industries</h2>
              <p className="card-subtitle">Select the industries your ideal customers belong to</p>
            </div>
          </div>
          <div className="form-chips">
            {INDUSTRY_PRESETS.map(ind => (
              <button
                key={ind}
                type="button"
                className={`chip ${industries.includes(ind) ? 'selected' : ''}`}
                onClick={() => toggleChip(industries, setIndustries, ind)}
              >
                {ind}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Add custom industry..."
              value={customIndustry}
              onChange={e => setCustomIndustry(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom(customIndustry, industries, setIndustries, setCustomIndustry);
                }
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => addCustom(customIndustry, industries, setIndustries, setCustomIndustry)}
              disabled={!customIndustry.trim()}
            >
              Add
            </button>
          </div>
          {industries.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <span className="form-hint">Selected: {industries.join(', ')}</span>
            </div>
          )}
        </div>

        {/* Company Size */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">👥 Company Size</h2>
              <p className="card-subtitle">Employee count range for your ideal targets</p>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Minimum Employees</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 50"
                value={employeeMin}
                onChange={e => setEmployeeMin(e.target.value)}
                min={0}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Maximum Employees</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 5000"
                value={employeeMax}
                onChange={e => setEmployeeMax(e.target.value)}
                min={0}
              />
            </div>
          </div>
          <p className="form-hint" style={{ marginTop: '0.5rem' }}>
            Leave blank to include all sizes
          </p>
        </div>



        {/* Target Locations */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">📍 Target Locations</h2>
              <p className="card-subtitle">Cities, countries, or regions</p>
            </div>
          </div>
          <div className="form-chips">
            {locations.map(loc => (
              <button
                key={loc}
                type="button"
                className="chip selected"
                onClick={() => toggleChip(locations, setLocations, loc)}
              >
                {loc} ✕
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. San Francisco, US, EMEA..."
              value={customLocation}
              onChange={e => setCustomLocation(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom(customLocation, locations, setLocations, setCustomLocation);
                }
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => addCustom(customLocation, locations, setLocations, setCustomLocation)}
            >
              Add
            </button>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">⚙️ Tech Stack Preference</h2>
              <p className="card-subtitle">Optional — filter by technology usage</p>
            </div>
          </div>
          <div className="form-chips">
            {TECH_PRESETS.map(tech => (
              <button
                key={tech}
                type="button"
                className={`chip ${techStack.includes(tech) ? 'selected' : ''}`}
                onClick={() => toggleChip(techStack, setTechStack, tech)}
              >
                {tech}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Add custom tech..."
              value={customTech}
              onChange={e => setCustomTech(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom(customTech, techStack, setTechStack, setCustomTech);
                }
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => addCustom(customTech, techStack, setTechStack, setCustomTech)}
              disabled={!customTech.trim()}
            >
              Add
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <div>
              <h2 className="card-title">📝 Additional Notes</h2>
              <p className="card-subtitle">Anything else we should know about your ideal customer?</p>
            </div>
          </div>
          <textarea
            className="form-textarea"
            placeholder="E.g., 'We prefer companies that recently raised Series B or later' or 'Focus on companies using modern cloud infrastructure'..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={!isValid}
          >
            Continue to Company Upload →
          </button>
        </div>
        {!isValid && (
          <p className="form-hint" style={{ textAlign: 'right', marginTop: '0.5rem' }}>
            Please select at least one target industry to continue
          </p>
        )}
      </form>
    </div>
  );
}
