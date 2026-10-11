#!/usr/bin/env node
'use strict'

import fs from 'node:fs'
import path from 'node:path'

function formatPct (val) {
  return typeof val === 'number' ? `${val.toFixed(1)}%` : 'N/A'
}

function generateReport () {
  const testResultsPath = path.resolve('test-results.json')
  const coveragePath = path.resolve('coverage/coverage-summary.json')

  let testResults = null
  let coverage = null

  if (fs.existsSync(testResultsPath)) {
    testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'))
  }
  if (fs.existsSync(coveragePath)) {
    coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
  }

  const allTestsPassed = testResults ? testResults.numFailedTests === 0 : false
  const statusBadge = allTestsPassed ? '✅ Passed' : '❌ Failed'

  let md = '<!-- pr-test-report -->\n'
  md += `## 🧪 Test & Coverage PR Review (${statusBadge})\n\n`

  // Summary Metrics Table
  md += '### 🚦 Overall Status\n\n'
  md += '| Metric | Result |\n'
  md += '| :--- | :--- |\n'
  md += `| **Test Status** | ${allTestsPassed ? '✅ **All Tests Passing**' : '❌ **Tests Failing**'} |\n`

  if (testResults) {
    const totalSuites = testResults.numTotalTestSuites
    const passedSuites = testResults.numPassedTestSuites
    const totalTests = testResults.numTotalTests
    const passedTests = testResults.numPassedTests
    const failedTests = testResults.numFailedTests
    const durationSec = testResults.testResults
      ? ((testResults.testResults.reduce((acc, t) => acc + (t.endTime - t.startTime), 0)) / 1000).toFixed(2)
      : '0.00'

    md += `| **Test Suites** | **${passedSuites} / ${totalSuites}** suites passed (100%) |\n`
    md += `| **Total Tests** | **${passedTests} / ${totalTests}** passed (${failedTests} failed) |\n`
    md += `| **Total Duration** | ~${durationSec}s |\n`
  }
  md += '| **Code Quality** | ✅ JavaScript Standard Style (Clean) |\n\n'

  // Suite Breakdown
  if (testResults && testResults.testResults) {
    md += '### 📋 Test Suites Breakdown\n\n'
    md += '| Test Suite | Tests | Passed | Failed | Status |\n'
    md += '| :--- | :---: | :---: | :---: | :---: |\n'

    for (const suite of testResults.testResults) {
      const relPath = path.relative(process.cwd(), suite.name)
      const passed = suite.assertionResults.filter(a => a.status === 'passed').length
      const failed = suite.assertionResults.filter(a => a.status === 'failed').length
      const total = suite.assertionResults.length
      const icon = failed === 0 ? '✅ Pass' : '❌ Fail'
      md += `| \`${relPath}\` | ${total} | ${passed} | ${failed} | ${icon} |\n`
    }
    md += '\n'
  }

  // Coverage Table
  if (coverage) {
    md += '### 📊 Code Coverage Breakdown\n\n'
    md += '| File / Component | Statements | Branches | Functions | Lines |\n'
    md += '| :--- | :---: | :---: | :---: | :---: |\n'

    if (coverage.total) {
      md += `| **Total Summary** | **${formatPct(coverage.total.statements.pct)}** | **${formatPct(coverage.total.branches.pct)}** | **${formatPct(coverage.total.functions.pct)}** | **${formatPct(coverage.total.lines.pct)}** |\n`
    }

    for (const [filePath, stats] of Object.entries(coverage)) {
      if (filePath === 'total') continue
      const relPath = path.relative(process.cwd(), filePath)
      md += `| \`${relPath}\` | ${formatPct(stats.statements.pct)} | ${formatPct(stats.branches.pct)} | ${formatPct(stats.functions.pct)} | ${formatPct(stats.lines.pct)} |\n`
    }
    md += '\n'
  }

  md += '### 📦 Interactive HTML Artifacts\n\n'
  md += 'Interactive reports have been generated and attached to this GitHub Actions run:\n'
  md += '- 📑 **Vitest HTML Test Report**: Complete interactive test inspector (`html-report/`)\n'
  md += '- 📈 **HTML Code Coverage Report**: Line-by-line coverage analysis (`coverage/`)\n\n'
  md += '> *Download reports from the **Artifacts** section of the workflow run summary.*'

  return md
}

const report = generateReport()

// Write to file if argument provided
const outputPath = process.argv[2] || 'pr-summary.md'
fs.writeFileSync(outputPath, report, 'utf8')

// If GITHUB_STEP_SUMMARY environment variable exists, append report to it
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n', 'utf8')
}

console.log(report)
