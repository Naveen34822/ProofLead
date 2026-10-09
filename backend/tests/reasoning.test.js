import { test } from 'node:test';
import assert from 'node:assert';
import { scoreCompany } from '/Users/naveen/Desktop/Caprae_Capital/frontend/src/utils/scoringEngine.js';

test('reason and outreach exclude unknown hiring, tech, and size (Loom case)', () => {
  const company = {
    domain: 'loom.com',
    industry: 'Communication',
    employeeSize: 'unknown',
    hiringSignals: null,
    techSignals: [],
    location: 'unknown',
    industryEvidence: 'Video messaging for work',
    hiringJobCount: null
  };

  const icp = {
    industries: ['Productivity', 'DevTools', 'Communication'],
    employeeMin: 50,
    employeeMax: 1000,
    locations: [],
    techStack: ['react']
  };

  const result = scoreCompany(company, icp);
  
  assert.ok(!result.reason.includes('unknown'), 'Reason should not contain the word unknown');
  assert.ok(!result.reason.includes('Hiring'), 'Reason should not mention Hiring if it is unknown');
  assert.ok(!result.reason.includes('Tech'), 'Reason should not mention Tech if it is unknown');
  assert.ok(!result.reason.includes('Size'), 'Reason should not mention Size if it is unknown');
  assert.ok(result.reason.includes('Industry matched (Communication)'), 'Reason should mention Industry');
  
  assert.ok(!result.outreach.includes('actively hiring'), 'Outreach should not mention actively hiring if unknown');
  assert.ok(!result.outreach.includes('team of unknown'), 'Outreach should not mention team size if unknown');
});
