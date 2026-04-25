#!/usr/bin/env node

/**
 * Asserts that test counts meet or exceed the baseline in tests/baseline.json.
 *
 * Usage:
 *   node scripts/check-test-baseline.js --unit 302
 *   node scripts/check-test-baseline.js --e2e 84
 *   node scripts/check-test-baseline.js --unit 302 --e2e 84
 *
 * Exit code 0 if all counts >= baseline, 1 otherwise.
 */

const fs = require('fs');
const path = require('path');

const baselinePath = path.join(__dirname, '..', 'tests', 'baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

const args = process.argv.slice(2);
let failures = 0;

function check(label, actual, expected) {
  if (actual >= expected) {
    console.log(`  ${label}: ${actual}/${expected} (baseline) -- PASS`);
  } else {
    console.log(`  ${label}: ${actual}/${expected} (baseline) -- FAIL: ${expected - actual} tests missing`);
    failures++;
  }
}

console.log('Test baseline check:');

const unitIdx = args.indexOf('--unit');
if (unitIdx !== -1) {
  const count = parseInt(args[unitIdx + 1], 10);
  if (isNaN(count)) {
    console.error('  --unit requires a number');
    process.exit(1);
  }
  check('Unit/Integration', count, baseline.unit);
}

const e2eIdx = args.indexOf('--e2e');
if (e2eIdx !== -1) {
  const count = parseInt(args[e2eIdx + 1], 10);
  if (isNaN(count)) {
    console.error('  --e2e requires a number');
    process.exit(1);
  }
  check('E2E', count, baseline.e2e);
}

if (unitIdx === -1 && e2eIdx === -1) {
  console.error('  Usage: node scripts/check-test-baseline.js --unit <count> [--e2e <count>]');
  process.exit(1);
}

console.log(`  Baseline updated: ${baseline.updated}`);
process.exit(failures > 0 ? 1 : 0);
