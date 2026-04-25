#!/usr/bin/env node

/**
 * Runs vitest, extracts the test count from output, and checks against baseline.
 * Usage: node scripts/run-test-check.js
 */

const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

// Run vitest with JSON reporter via node to avoid Windows .cmd shim issues
const vitestEntry = path.join(root, 'node_modules', 'vitest', 'vitest.mjs');
const spawn = spawnSync('node', [vitestEntry, 'run', '--reporter=json'], {
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: root,
});

const result = spawn.stdout || '';
if (!result) {
  console.error('Failed to run vitest:', spawn.stderr || spawn.error?.message || 'unknown error');
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(result);
} catch {
  console.error('Failed to parse vitest JSON output');
  process.exit(1);
}

const total = parsed.numTotalTests;
const failed = parsed.numFailedTests;

if (failed > 0) {
  console.error(`\n  ${failed} test(s) failed. Fix failures before checking baseline.\n`);
  process.exit(1);
}

// Check against baseline
try {
  execFileSync('node', [path.join('scripts', 'check-test-baseline.js'), '--unit', String(total)], {
    stdio: 'inherit',
    cwd: root,
  });
} catch {
  process.exit(1);
}
