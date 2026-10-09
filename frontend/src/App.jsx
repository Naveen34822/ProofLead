import { useState, useCallback } from 'react';
import ICPForm from './components/ICPForm';
import CompanyUpload from './components/CompanyUpload';
import EnrichingOverlay from './components/EnrichingOverlay';
import ResultsDashboard from './components/ResultsDashboard';
import DetailPanel from './components/DetailPanel';
import { enrichBatch } from './utils/enrichmentEngine';
import { scoreAndRankLeads, leadsToCSV } from './utils/scoringEngine';
import { sampleCompanies } from './data/sampleCompanies';

const STEPS = [
  { id: 'icp', label: 'Define ICP', number: 1 },
  { id: 'upload', label: 'Add Companies', number: 2 },
  { id: 'results', label: 'View Results', number: 3 },
];

function App() {
  const [currentStep, setCurrentStep] = useState('icp');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [icp, setIcp] = useState(null);
  const [rawCompanies, setRawCompanies] = useState([]);
  const [scoredLeads, setScoredLeads] = useState(null);
  const [stats, setStats] = useState(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, name: '' });
  const [selectedLead, setSelectedLead] = useState(null);

  // Step 1: ICP submitted
  const handleICPSubmit = useCallback((icpData) => {
    setIcp(icpData);
    setCompletedSteps(prev => [...new Set([...prev, 'icp'])]);
    setCurrentStep('upload');
  }, []);

  // Step 2: Companies uploaded
  const handleCompaniesSubmit = useCallback(async (companies) => {
    setRawCompanies(companies);
    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: companies.length, name: '' });

    try {
      // Enrich all companies
      const enriched = await enrichBatch(companies, (current, total, name) => {
        setEnrichProgress({ current, total, name });
      });

      // Score and rank
      const result = scoreAndRankLeads(enriched, icp);
      setScoredLeads(result.leads);
      setStats(result.stats);
      setCompletedSteps(prev => [...new Set([...prev, 'upload'])]);
      setCurrentStep('results');
    } catch (err) {
      console.error('Enrichment failed:', err);
      alert('Something went wrong during enrichment. Please try again.');
    } finally {
      setIsEnriching(false);
    }
  }, [icp]);

  // Use sample data
  const handleUseSampleData = useCallback(async () => {
    const minimal = sampleCompanies.map(c => ({
      name: c.name,
      domain: c.domain,
      website: c.website
    }));
    await handleCompaniesSubmit(minimal);
  }, [handleCompaniesSubmit]);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (!scoredLeads) return;
    const csv = leadsToCSV(scoredLeads);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prooflead-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scoredLeads]);

  // Update lead status
  const handleStatusChange = useCallback((domain, newStatus) => {
    setScoredLeads(prev => prev.map(lead =>
      lead.domain === domain ? { ...lead, status: newStatus } : lead
    ));
  }, []);

  // Retry failed leads
  const handleRetryFailedLeads = useCallback(async () => {
    if (!scoredLeads) return;
    const failedLeads = scoredLeads.filter(l => l.enrichmentStatus === 'failed');
    if (failedLeads.length === 0) return;
    
    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: failedLeads.length, name: 'Retrying failures...' });

    try {
      const companiesToRetry = failedLeads.map(l => ({ name: l.name, domain: l.domain, website: l.website }));
      const newEnriched = await enrichBatch(companiesToRetry, (current, total, name) => {
        setEnrichProgress({ current, total, name });
      });

      // Merge newEnriched with existing valid leads
      const validLeads = scoredLeads.filter(l => l.enrichmentStatus !== 'failed');
      const combined = [...validLeads, ...newEnriched];
      
      const result = scoreAndRankLeads(combined, icp);
      setScoredLeads(result.leads);
      setStats(result.stats);
    } catch (err) {
      console.error('Retry failed:', err);
      alert('Retry failed. Please try again.');
    } finally {
      setIsEnriching(false);
    }
  }, [scoredLeads, icp]);

  const handleIcpPresetChange = useCallback((presetType) => {
    if (!scoredLeads) return;
    
    let newIcp;
    if (presetType === 'demo') {
      newIcp = {
        industries: ['DevTools'],
        employeeMin: 50,
        employeeMax: 200,
        techStack: []
      };
    } else {
      newIcp = icp; // We'd need to store the original somewhere if we truly switch back and forth.
      // Assuming 'current' means just re-run with whatever is in state. But since we overwrite icp, it's a bit tricky.
      // Wait, let's keep originalIcp in state if we want to switch back, or just let 'current' re-score with the last selected ICP.
      newIcp = icp;
    }
    
    const result = scoreAndRankLeads(scoredLeads, newIcp);
    setScoredLeads(result.leads);
    setStats(result.stats);
    if (presetType === 'demo') {
      setIcp(newIcp);
    }
  }, [scoredLeads, icp]);

  // Navigate steps
  const handleStepClick = useCallback((stepId) => {
    const stepIndex = STEPS.findIndex(s => s.id === stepId);
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    // Can go back or to completed step
    if (stepIndex <= currentIndex || completedSteps.includes(stepId)) {
      setCurrentStep(stepId);
    }
  }, [currentStep, completedSteps]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">L</div>
            <div className="logo-text">
              Lead<span>Scout</span>
            </div>
          </div>
          <nav className="header-nav">
            {STEPS.map((step, i) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {i > 0 && <div className="nav-divider" />}
                <button
                  className={`nav-step ${currentStep === step.id ? 'active' : ''} ${completedSteps.includes(step.id) ? 'completed' : ''}`}
                  onClick={() => handleStepClick(step.id)}
                >
                  <span className="nav-step-number">
                    {completedSteps.includes(step.id) ? '✓' : step.number}
                  </span>
                  {step.label}
                </button>
              </div>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {currentStep === 'icp' && (
          <ICPForm onSubmit={handleICPSubmit} initialData={icp} />
        )}
        {currentStep === 'upload' && (
          <CompanyUpload
            onSubmit={handleCompaniesSubmit}
            onUseSample={handleUseSampleData}
            onBack={() => setCurrentStep('icp')}
          />
        )}
        {currentStep === 'results' && scoredLeads && (
          <ResultsDashboard
            leads={scoredLeads}
            stats={stats}
            icp={icp}
            onExport={handleExportCSV}
            onSelectLead={setSelectedLead}
            onStatusChange={handleStatusChange}
            onRetryFailed={handleRetryFailedLeads}
            onIcpChange={handleIcpPresetChange}
            onStartOver={() => {
              setCurrentStep('icp');
              setCompletedSteps([]);
              setScoredLeads(null);
              setStats(null);
              setIcp(null);
            }}
          />
        )}
      </main>

      {/* Enriching overlay */}
      {isEnriching && (
        <EnrichingOverlay progress={enrichProgress} />
      )}

      {/* Detail panel */}
      {selectedLead && (
        <DetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

export default App;
