import assert from 'node:assert';
import { test } from 'node:test';
import { scoreCompany } from './scoringEngine.js';

test('industryMatchScore matches SaaS sub-labels consistently', () => {
  const icp = {
    industries: ['SaaS'],
    employeeMin: 50,
    employeeMax: 200,
    techStack: []
  };

  // 1. Postman: SaaS / API Management -> should match SaaS
  const postman = {
    industry: 'SaaS / API Management',
    employeeSize: '500', // mismatched size to isolate industry
    hiringSignals: false,
    techSignals: []
  };
  
  const postmanScore = scoreCompany(postman, icp);
  assert.strictEqual(postmanScore.factors.industry.score, 100, 'Postman industry should match 100%');

  // 2. Vercel: SaaS / Cloud Infrastructure -> should match SaaS
  const vercel = {
    industry: 'SaaS / Cloud Infrastructure',
    employeeSize: '500',
    hiringSignals: false,
    techSignals: []
  };
  
  const vercelScore = scoreCompany(vercel, icp);
  assert.strictEqual(vercelScore.factors.industry.score, 100, 'Vercel industry should match 100%');
  
  // 3. Subscription Billing -> should match SaaS/FinTech map
  const chargebee = {
    industry: 'Subscription Billing',
    employeeSize: 'unknown',
    hiringSignals: false,
    techSignals: []
  };
  
  const fintechIcp = {
    industries: ['FinTech'],
    employeeMin: 0,
    employeeMax: 1000,
    techStack: []
  };
  
  const chargebeeScore = scoreCompany(chargebee, fintechIcp);
  assert.strictEqual(chargebeeScore.factors.industry.score, 100, 'Chargebee should match FinTech mapped industry');
});

test('Coverage Caps apply correctly', () => {
  const icp = {
    industries: ['SaaS'],
    employeeMin: 50,
    employeeMax: 200,
    techStack: ['React']
  };

  // 1 signal (Industry matched)
  const oneSignal = {
    industry: 'SaaS',
    employeeSize: 'unknown',
    hiringSignals: null,
    hiringSignalsEvidence: 'unknown',
    techSignals: []
  };
  const res1 = scoreCompany(oneSignal, icp);
  assert.strictEqual(res1.score, 40, '1 signal should cap at 40');

  // 2 signals (Industry and Size)
  const twoSignals = {
    industry: 'SaaS',
    employeeSize: '100',
    hiringSignals: null,
    hiringSignalsEvidence: 'unknown',
    techSignals: []
  };
  const res2 = scoreCompany(twoSignals, icp);
  assert.strictEqual(res2.score, 65, '2 signals should cap at 65');
  
  // 3 signals (Industry, Size, Tech) but low confidence
  const threeSignalsLowConfidence = {
    industry: 'SaaS',
    employeeSize: '100',
    hiringSignals: null,
    hiringSignalsEvidence: 'unknown',
    techSignals: ['React'],
    confidence: 'low'
  };
  const res3 = scoreCompany(threeSignalsLowConfidence, icp);
  assert.strictEqual(res3.score, 74, '3 signals with low confidence should cap at 74');
});
