const assert = require('assert');

// The verifier function used in server.js
const normalize = (str) => String(str).toLowerCase().replace(/[\u2018\u2019\u201C\u201D"']/g, '').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
const verifyEvidence = (evidence, fullText) => {
  if (!evidence || evidence === 'unknown' || evidence === 'Not found on fetched pages') return true;
  if (String(evidence).startsWith('Found in ATS')) return true;
  const normalizedEvidence = normalize(evidence);
  const normalizedText = normalize(fullText);
  return normalizedText.includes(normalizedEvidence);
};

const fullText = `Welcome to ACME Corp. We are a B2B SaaS company providing analytics tools for modern teams.
Our headquarters is in New York City, USA. Join our fast-growing team of 50-200 employees.
Sign up today for our free trial and see why thousands trust our platform.`;

// 1. Fake quote rejected
const fakeQuote = "We provide the best CRM solution in the market.";
assert.strictEqual(verifyEvidence(fakeQuote, fullText), false, "Fake quote should be rejected");

// 2. Real but irrelevant quote accepted (Limitation)
const irrelevantQuote = "Join our fast-growing team of 50-200 employees.";
// If the LLM uses this quote for businessModel, it passes the text check even though it's irrelevant.
assert.strictEqual(verifyEvidence(irrelevantQuote, fullText), true, "Real but irrelevant quote is accepted");

// 3. Valid quote accepted
const validQuote = "We are a B2B SaaS company providing analytics tools";
assert.strictEqual(verifyEvidence(validQuote, fullText), true, "Valid quote should be accepted");

console.log("All verifier tests passed.");
