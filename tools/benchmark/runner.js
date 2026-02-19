#!/usr/bin/env node
/**
 * AI Impact Benchmark Runner
 * Orchestrates Experiment A (Greenfield) and B (Onboarding)
 * Tracks metrics, generates scorecards, produces final report
 */

const { promises: fs } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const BENCHMARK_ROOT = process.env.BENCHMARK_ROOT || '.';

class BenchmarkRunner {
  constructor(experimentType, teamConfig) {
    this.experiment = experimentType; // 'greenfield' | 'onboarding'
    this.teams = teamConfig; // { control: {...}, treatment: {...} }
    this.startTime = Date.now();
    this.metrics = {
      control: this.initMetrics(),
      treatment: this.initMetrics()
    };
  }

  initMetrics() {
    return {
      timeToFirstBuild: null,
      timeToFirstFeature: null,
      timeToMVP: null,
      locWritten: 0,
      aiGeneratedLOC: 0,
      commits: 0,
      questionsToMentor: 0,
      prCount: 0,
      mergedPRCount: 0,
      avgTimeToMergePR: 0,
      testCoverage: 0,
      architecturalViolations: 0,
      bugsFoundInQA: 0,
      developerFatigue: 0 // self-reported 1-10
    };
  }

  async start() {
    console.log(`🚀 Starting ${this.experiment} benchmark`);
    await this.setupEnvironment();
    await this.startTiming();
    await this.runExperiment();
    await this.collectFinalMetrics();
    await this.generateReport();
  }

  async setupEnvironment() {
    // Create workspace for each team
    for (const [teamName, team] of Object.entries(this.teams)) {
      const workspace = path.join(BENCHMARK_ROOT, `workspace-${teamName}`);
      await this.exec(`rm -rf ${workspace} && mkdir -p ${workspace}`);
      team.workspace = workspace;

      // Clone template if greenfield
      if (this.experiment === 'greenfield') {
        await this.exec(`git clone ${team.templateRepo} ${workspace}`, { cwd: workspace });
      } else if (this.experiment === 'onboarding') {
        // Copy existing brownfield codebase
        await this.exec(`cp -r ${team.codebaseSource}/* ${workspace}/`);
      }

      // Initialize metric collection
      team.startTime = Date.now();
    }
  }

  async startTiming() {
    this.globalStart = Date.now();
    console.log('⏱️ Timer started');
  }

  async runExperiment() {
    // This method is overridden by specific experiment implementations
    throw new Error('runExperiment must be implemented by subclass');
  }

  async collectFinalMetrics() {
    for (const [teamName, team] of Object.entries(this.teams)) {
      const elapsed = (Date.now() - team.startTime) / 1000 / 60; // minutes
      this.metrics[teamName].timeTotal = elapsed;

      // Collect git stats
      const gitStats = await this.exec(`git log --oneline --since="${team.startTime}" | wc -l`, { cwd: team.workspace });
      this.metrics[teamName].commits = parseInt(gitStats.stdout);

      // Count lines of code added
      const locAdded = await this.exec(`git diff --stat HEAD~1..HEAD | grep -E "\.go|\.cs|\.tsx?$" | awk '{sum+=$1} END {print sum}'`, { cwd: team.workspace });
      this.metrics[teamName].locWritten = parseInt(locAdded.stdout) || 0;

      // Test coverage (if available)
      try {
        const coverage = await this.exec(`go test ./... -cover | grep "coverage:" | awk '{print $2}'`, { cwd: team.workspace });
        this.metrics[teamName].testCoverage = parseFloat(coverage.stdout.replace('%', ''));
      } catch (e) {
        // No coverage available
      }

      // TODO: Collect AI-generated LOC via OpenCode logs (integration needed)
    }
  }

  async generateReport() {
    const report = {
      experiment: this.experiment,
      timestamp: new Date().toISOString(),
      durationMinutes: (Date.now() - this.globalStart) / 1000 / 60,
      teams: {}
    };

    for (const [teamName, team] of Object.entries(this.teams)) {
      report.teams[teamName] = {
        ...this.metrics[teamName],
        scorecard: await this.generateScorecard(teamName)
      };
    }

    // Calculate advantage ratios
    report.comparative = this.calculateAdvantage();

    // Write report
    const reportPath = path.join(BENCHMARK_ROOT, `reports/${this.experiment}-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Report generated: ${reportPath}`);
    return report;
  }

  async generateScorecard(teamName) {
    const team = this.teams[teamName];
    const metrics = this.metrics[teamName];

    // Implement scoring rubric based on experiment type
    if (this.experiment === 'greenfield') {
      return this.scoreGreenfield(team, metrics);
    } else if (this.experiment === 'onboarding') {
      return this.scoreOnboarding(team, metrics);
    }
  }

  scoreGreenfield(team, metrics) {
    return {
      mvpTimeMinutes: metrics.timeTotal,
      velocity: metrics.locWritten / (metrics.timeTotal / 60), // LOC/hour
      quality: {
        testCoverage: metrics.testCoverage,
        architecturalViolations: metrics.architecturalViolations,
        qaBugs: metrics.bugsFoundInQA
      },
      aiUtilization: metrics.aiGeneratedLOC / metrics.locWritten
    };
  }

  scoreOnboarding(team, metrics) {
    return {
      timeToFirstPR: metrics.timeToFirstBuild, // placeholder
      timeToIndependent: metrics.timeTotal,
      questionsAsked: metrics.questionsToMentor,
      prSuccessRate: metrics.mergedPRCount / Math.max(metrics.prCount, 1),
      codeQuality: metrics.bugsFoundInQA
    };
  }

  calculateAdvantage() {
    const c = this.metrics.control;
    const t = this.metrics.treatment;

    return {
      velocityRatio: (t.locWritten / t.timeTotal) / (c.locWritten / c.timeTotal),
      onboardingSpeedup: c.timeTotal / t.timeTotal,
      defectRateRatio: (t.bugsFoundInQA / t.locWritten) / (c.bugsFoundInQA / c.locWritten)
    };
  }

  async exec(command, options = {}) {
    return new Promise((resolve, reject) => {
      execSync(command, { stdio: 'pipe', ...options }, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
      });
    });
  }
}

// Export for use by experiment-specific runners
module.exports = { BenchmarkRunner };
