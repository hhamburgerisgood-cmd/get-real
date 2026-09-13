#!/usr/bin/env node
/**
 * tests/run_all_tests.js
 * Master CLI test runner for "Get Real" web application transformation.
 * Executes all 4 test tiers (Tier 1 Features, Tier 2 Boundaries, Tier 3 Cross-Feature, Tier 4 Workloads).
 * Provides granular filtering, ANSI colored diagnostics, scorecard tables, and exit codes.
 *
 * Usage:
 *   node tests/run_all_tests.js                     # Run all 4 tiers
 *   node tests/run_all_tests.js --tier 1           # Run Tier 1 only
 *   node tests/run_all_tests.js --feature R1       # Run R1 feature tests
 *   node tests/run_all_tests.js --filter "Search"   # Run tests matching regex/text
 *   node tests/run_all_tests.js --verbose           # Verbose error output
 *   node tests/run_all_tests.js --json              # Output JSON results
 */

const { performance } = require('perf_hooks');

const tier1 = require('./tier1_features.test');
const tier2 = require('./tier2_boundaries.test');
const tier3 = require('./tier3_cross_feature.test');
const tier4 = require('./tier4_workloads.test');

// ANSI Color helper
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function parseArgs(args) {
  const options = {
    tier: null,
    feature: null,
    filter: '',
    verbose: false,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tier' || arg === '-t') {
      options.tier = parseInt(args[++i], 10);
    } else if (arg === '--feature' || arg === '-f') {
      options.feature = args[++i].toUpperCase();
    } else if (arg === '--filter') {
      options.filter = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${colors.bold}Get Real Automated E2E Test Suite Runner${colors.reset}

${colors.bold}Usage:${colors.reset}
  node tests/run_all_tests.js [options]

${colors.bold}Options:${colors.reset}
  --tier, -t <1-4>      Run a specific tier only (1: Features, 2: Boundaries, 3: Cross, 4: Workloads)
  --feature, -f <R1-R6> Filter tests by requirement feature (R1 to R6)
  --filter <query>      Filter tests by ID or name substring
  --verbose, -v         Display detailed error traces and step-by-step test execution
  --json                Output results in JSON format
  --help, -h            Show this help documentation
`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const allSuites = [
    { tier: 1, name: 'Tier 1: Feature Coverage (R1-R6)', tests: tier1.tests },
    { tier: 2, name: 'Tier 2: Boundary & Corner Cases (R1-R6)', tests: tier2.tests },
    { tier: 3, name: 'Tier 3: Cross-Feature Combinations', tests: tier3.tests },
    { tier: 4, name: 'Tier 4: Real-World Application Workloads', tests: tier4.tests }
  ];

  const selectedSuites = options.tier
    ? allSuites.filter(s => s.tier === options.tier)
    : allSuites;

  if (selectedSuites.length === 0) {
    console.error(`${colors.red}Error: Invalid tier ${options.tier}. Must be 1, 2, 3, or 4.${colors.reset}`);
    process.exit(1);
  }

  if (!options.json) {
    console.log(`\n${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}         GET REAL WEB APP — 4-TIER AUTOMATED E2E TEST RUNNER          ${colors.reset}`);
    console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}\n`);
  }

  const overallStart = performance.now();
  const summary = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    durationMs: 0,
    tierResults: [],
    featureResults: {},
    failures: []
  };

  for (const suite of selectedSuites) {
    let suiteTests = suite.tests;

    if (options.feature) {
      suiteTests = suiteTests.filter(t => t.feature === options.feature);
    }

    if (options.filter) {
      const q = options.filter.toLowerCase();
      suiteTests = suiteTests.filter(t => t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q));
    }

    if (!options.json) {
      console.log(`${colors.bold}${colors.blue}▶ ${suite.name}${colors.reset} (${suiteTests.length} tests)`);
    }

    const tierRecord = {
      tier: suite.tier,
      name: suite.name,
      total: suiteTests.length,
      passed: 0,
      failed: 0,
      durationMs: 0
    };

    const suiteStart = performance.now();

    for (const test of suiteTests) {
      summary.totalTests++;
      const featKey = test.feature || 'General';
      if (!summary.featureResults[featKey]) {
        summary.featureResults[featKey] = { total: 0, passed: 0, failed: 0 };
      }
      summary.featureResults[featKey].total++;

      const tStart = performance.now();
      try {
        await test.fn();
        const tElapsed = Math.round(performance.now() - tStart);
        summary.passed++;
        tierRecord.passed++;
        summary.featureResults[featKey].passed++;

        if (!options.json) {
          console.log(`  ${colors.green}✔ PASS${colors.reset} [${test.id}] ${test.name} ${colors.dim}(${tElapsed}ms)${colors.reset}`);
        }
      } catch (err) {
        const tElapsed = Math.round(performance.now() - tStart);
        summary.failed++;
        tierRecord.failed++;
        summary.featureResults[featKey].failed++;

        const failInfo = {
          id: test.id,
          tier: test.tier,
          feature: test.feature,
          name: test.name,
          durationMs: tElapsed,
          message: err.message,
          stack: err.stack
        };
        summary.failures.push(failInfo);

        if (!options.json) {
          console.log(`  ${colors.red}✖ FAIL${colors.reset} [${test.id}] ${test.name} ${colors.dim}(${tElapsed}ms)${colors.reset}`);
          console.log(`         ${colors.red}${err.message}${colors.reset}`);
          if (options.verbose && err.stack) {
            console.log(`         ${colors.dim}${err.stack.split('\n').slice(1, 4).join('\n         ')}${colors.reset}`);
          }
        }
      }
    }

    tierRecord.durationMs = Math.round(performance.now() - suiteStart);
    summary.tierResults.push(tierRecord);
    if (!options.json) console.log('');
  }

  summary.durationMs = Math.round(performance.now() - overallStart);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.failed > 0 ? 1 : 0);
  }

  // CLI Summary Scorecard
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bold}                           TEST SCORECARD                             ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================================${colors.reset}`);

  console.log(`\n${colors.bold}Tier Breakdown:${colors.reset}`);
  console.log('----------------------------------------------------------------------');
  console.log(`Tier                               Total    Passed    Failed    Pass Rate`);
  console.log('----------------------------------------------------------------------');
  for (const tr of summary.tierResults) {
    const rate = tr.total > 0 ? Math.round((tr.passed / tr.total) * 100) : 0;
    const rateColor = rate === 100 ? colors.green : (rate >= 50 ? colors.yellow : colors.red);
    const tierNamePad = tr.name.padEnd(35);
    const totPad = String(tr.total).padStart(5);
    const passPad = String(tr.passed).padStart(9);
    const failPad = String(tr.failed).padStart(9);
    const ratePad = `${rate}%`.padStart(11);
    console.log(`${tierNamePad} ${totPad} ${passPad} ${failPad} ${rateColor}${ratePad}${colors.reset}`);
  }
  console.log('----------------------------------------------------------------------');

  console.log(`\n${colors.bold}Feature Breakdown:${colors.reset}`);
  console.log('----------------------------------------------------------------------');
  console.log(`Feature                             Total    Passed    Failed    Pass Rate`);
  console.log('----------------------------------------------------------------------');
  for (const [feat, stats] of Object.entries(summary.featureResults)) {
    const rate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
    const rateColor = rate === 100 ? colors.green : (rate >= 50 ? colors.yellow : colors.red);
    const featPad = feat.padEnd(35);
    const totPad = String(stats.total).padStart(5);
    const passPad = String(stats.passed).padStart(9);
    const failPad = String(stats.failed).padStart(9);
    const ratePad = `${rate}%`.padStart(11);
    console.log(`${featPad} ${totPad} ${passPad} ${failPad} ${rateColor}${ratePad}${colors.reset}`);
  }
  console.log('----------------------------------------------------------------------');

  if (summary.failures.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Implementation Defects Discovered to Escalate (${summary.failures.length} total):${colors.reset}`);
    summary.failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.id}] (${f.feature}) ${f.name}`);
      console.log(`     ${colors.dim}Reason: ${f.message}${colors.reset}`);
    });
  }

  const overallRate = summary.totalTests > 0 ? Math.round((summary.passed / summary.totalTests) * 100) : 0;
  const statusColor = summary.failed === 0 ? colors.green : colors.yellow;

  console.log(`\n${colors.bold}Execution Summary:${colors.reset}`);
  console.log(`  Total Tests Executed : ${colors.bold}${summary.totalTests}${colors.reset}`);
  console.log(`  Passed               : ${colors.green}${summary.passed}${colors.reset}`);
  console.log(`  Failed               : ${colors.red}${summary.failed}${colors.reset}`);
  console.log(`  Overall Pass Rate    : ${statusColor}${overallRate}%${colors.reset}`);
  console.log(`  Elapsed Time         : ${summary.durationMs}ms\n`);

  if (summary.failed === 0) {
    console.log(`${colors.bold}${colors.green}>>> ALL TESTS PASSED! APPLICATION MEETS 100% SPECIFICATIONS. <<<${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.bold}${colors.red}>>> ${summary.failed} TESTS FAILED. IMPLEMENTATION DEFECTS MUST BE RESOLVED. <<<${colors.reset}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal runner error:', err);
    process.exit(1);
  });
}

module.exports = { main };
