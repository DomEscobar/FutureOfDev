#!/usr/bin/env node
/**
 * AI Impact Benchmark Runner (Updated for Refactor Experiment)
 * Supports: greenfield, onboarding, refactor
 */

const { promises: fs } = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const BENCHMARK_ROOT = process.env.BENCHMARK_ROOT || '.';

class BenchmarkRunner {
  constructor(experimentType, teamConfig) {
    this.experiment = experimentType; // 'greenfield' | 'onboarding' | 'refactor'
    this.teams = teamConfig; // { control: {...}, treatment: {...} }
    this.startTime = Date.now();
    this.metrics = {
      control: this.initMetrics(),
      treatment: this.initMetrics()
    };
  }

  initMetrics() {
    const base = {
      timeTotal: 0,
      locWritten: 0,
      locChanged: 0,
      commits: 0,
      prCount: 0,
      mergedPRCount: 0,
      avgTimeToMergePR: 0,
      testCoverage: 0,
      bugsFoundInQA: 0,
      developerFatigue: 0,
      manualInterventionHours: 0
    };

    if (this.experiment === 'refactor') {
      return {
        ...base,
        breakingChangesIntroduced: 0,
        rippleCoveragePercent: 0,
        testPassRateDuringRefactor: 0,
        migrationOrderEfficiency: 0
      };
    }

    return base;
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
    for (const [teamName, team] of Object.entries(this.teams)) {
      const workspace = path.join(BENCHMARK_ROOT, `workspace-${teamName}`);
      await this.exec(`rm -rf ${workspace} && mkdir -p ${workspace}`);
      team.workspace = workspace;

      if (this.experiment === 'greenfield') {
        await this.exec(`git clone ${team.templateRepo} ${workspace}`, { cwd: workspace });
        await this.exec('git checkout main', { cwd: workspace });
      } else if (this.experiment === 'onboarding') {
        await this.exec(`cp -r ${team.codebaseSource}/* ${workspace}/`);
      } else if (this.experiment === 'refactor') {
        await this.exec(`git clone ${team.codebaseSource} ${workspace}`, { cwd: workspace });
        await this.exec('git checkout main', { cwd: workspace });
      }

      team.startTime = Date.now();
    }
  }

  async startTiming() {
    this.globalStart = Date.now();
    console.log('⏱️ Timer started');
  }

  async runExperiment() {
    throw new Error('runExperiment must be implemented by subclass');
  }

  async collectFinalMetrics() {
    for (const [teamName, team] of Object.entries(this.teams)) {
      const elapsed = (Date.now() - team.startTime) / 1000 / 60;
      this.metrics[teamName].timeTotal = elapsed;

      // Git stats
      try {
        const gitStats = await this.exec(`git log --oneline --since="${new Date(team.startTime).toISOString()}" | wc -l`, { cwd: team.workspace });
        this.metrics[teamName].commits = parseInt(gitStats.stdout);
      } catch (e) {}

      // LOC changed (refactor) or added (greenfield)
      const locMetric = this.experiment === 'refactor' ? 'locChanged' : 'locWritten';
      try {
        // Get all changed files (not just committed, but overall changes in workspace)
        const diffCmd = this.experiment === 'refactor'
          ? `git diff --stat HEAD...HEAD@{1} | grep -E "\.(go|cs|ts|tsx|js|jsx)$" | awk '{sum+=$1} END {print sum}'`
          : `git diff --stat HEAD@{0}..HEAD@{1} | grep -E "\.(go|cs|ts|tsx|js|jsx)$" | awk '{sum+=$1} END {print sum}'`;

        const loc = await this.exec(diffCmd, { cwd: team.workspace });
        this.metrics[teamName][locMetric] = parseInt(loc.stdout) || 0;
      } catch (e) {}

      // Test coverage
      try {
        let coverage = 0;
        if (this.hasGoFiles(team.workspace)) {
          const cov = await this.exec('go test ./... -cover', { cwd: team.workspace });
          const match = cov.stdout.match(/coverage:\s*([\d.]+)%/);
          if (match) coverage = parseFloat(match[1]);
        } else if (this.hasCsFiles(team.workspace)) {
          const cov = await this.exec('dotnet test --collect:"XPlat Code Coverage"', { cwd: team.workspace });
          // Parse coverage from cobertura or other format (simplified)
          coverage = this.parseDotnetCoverage(cov.stdout);
        }
        this.metrics[teamName].testCoverage = coverage;
      } catch (e) {
        // Coverage not available
      }

      // Refactor-specific metrics
      if (this.experiment === 'refactor') {
        await this.collectRefactorMetrics(teamName, team);
      }
    }
  }

  async collectRefactorMetrics(teamName, team) {
    // Breaking changes: compare OpenAPI specs before/after
    try {
      const beforeSpec = await this.exec('find . -name "openapi.yaml" -o -name "swagger.json" | head -1 | xargs cat', { cwd: team.workspace });
      // In a real scenario, we'd have a baseline; here we approximate
      this.metrics[teamName].breakingChangesIntroduced = this.detectBreakingChanges(beforeSpec.stdout);
    } catch (e) {}

    // Ripple coverage: check how many dependent services were updated
    this.metrics[teamName].rippleCoveragePercent = await this.calculateRippleCoverage(team.workspace);

    // Test pass rate during refactor
    this.metrics[teamName].testPassRateDuringRefactor = await this.calculateTestPassRate(team.workspace);
  }

  detectBreakingChanges(openapiSpec) {
    // Simplified: count removed endpoints, changed schemas
    // In reality, use an OpenAPI diff library
    return Math.floor(Math.random() * 5); // placeholder
  }

  async calculateRippleCoverage(workspace) {
    // Count services that were updated vs. total dependents
    try {
      const updated = await this.exec('git diff --name-only | grep -E "^services/" | wc -l', { cwd: workspace });
      const total = await this.exec('find services -name "*.go" -o -name "*.cs" | wc -l', { cwd: workspace });
      return (parseInt(updated.stdout) / Math.max(parseInt(total.stdout), 1)) * 100;
    } catch (e) {
      return 0;
    }
  }

  async calculateTestPassRate(workspace) {
    try {
      const testRun = await this.exec('go test ./... 2>&1 | grep -E "PASS|FAIL"', { cwd: workspace });
      const passes = (testRun.stdout.match(/PASS/g) || []).length;
      const fails = (testRun.stdout.match(/FAIL/g) || []).length;
      return passes / Math.max(passes + fails, 1) * 100;
    } catch (e) {
      return 0;
    }
  }

  hasGoFiles(workspace) {
    try {
      const result = execSync(`find ${workspace} -name "*.go" | head -1`, { stdio: 'pipe' });
      return result.length > 0;
    } catch (e) {
      return false;
    }
  }

  hasCsFiles(workspace) {
    try {
      const result = execSync(`find ${workspace} -name "*.cs" -o -name "*.csproj" | head -1`, { stdio: 'pipe' });
      return result.length > 0;
    } catch (e) {
      return false;
    }
  }

  parseDotnetCoverage(output) {
    // Simplified extraction
    const match = output.match(/(\d+(\.\d+)?)%/);
    return match ? parseFloat(match[1]) : 0;
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

    report.comparative = this.calculateAdvantage();

    const reportPath = path.join(BENCHMARK_ROOT, `reports/${this.experiment}-${Date.now()}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Report generated: ${reportPath}`);
    return report;
  }

  async generateScorecard(teamName) {
    const team = this.teams[teamName];
    const metrics = this.metrics[teamName];

    if (this.experiment === 'greenfield') {
      return this.scoreGreenfield(team, metrics);
    } else if (this.experiment === 'onboarding') {
      return this.scoreOnboarding(team, metrics);
    } else if (this.experiment === 'refactor') {
      return this.scoreRefactor(team, metrics);
    }
  }

  scoreGreenfield(team, metrics) {
    return {
      mvpTimeMinutes: metrics.timeTotal,
      velocity: metrics.locWritten / (metrics.timeTotal / 60),
      quality: {
        testCoverage: metrics.testCoverage,
        architecturalViolations: metrics.architecturalViolations,
        qaBugs: metrics.bugsFoundInQA
      },
      aiUtilization: metrics.aiGeneratedLOC / Math.max(metrics.locWritten, 1)
    };
  }

  scoreOnboarding(team, metrics) {
    return {
      timeToFirstPR: metrics.timeToFirstBuild,
      timeToProductive: metrics.timeTotal,
      questionsAsked: metrics.questionsToMentor,
      prSuccessRate: metrics.mergedPRCount / Math.max(metrics.prCount, 1),
      codeQuality: metrics.bugsFoundInQA
    };
  }

  scoreRefactor(team, metrics) {
    return {
      refactorVelocity: metrics.locChanged / (metrics.timeTotal / 60), // LOC/day
      safety: {
        breakingChanges: metrics.breakingChangesIntroduced,
        regressionBugs: metrics.bugsFoundInQA,
        testPassRate: metrics.testPassRateDuringRefactor
      },
      rippleEffectiveness: metrics.rippleCoveragePercent,
      manualOversight: metrics.manualInterventionHours
    };
  }

  calculateAdvantage() {
    const c = this.metrics.control;
    const t = this.metrics.treatment;

    const base = {};

    if (this.experiment === 'greenfield' || this.experiment === 'refactor') {
      base.velocityRatio = (t.locWritten / t.timeTotal) / (c.locWritten / c.timeTotal);
    }

    if (this.experiment === 'onboarding') {
      base.onboardingSpeedup = c.timeTotal / t.timeTotal;
    }

    if (this.experiment === 'refactor') {
      base.breakingChangeReduction = c.breakingChangesIntroduced / Math.max(t.breakingChangesIntroduced, 1);
      base.regressionRateRatio = (t.bugsFoundInQA / Math.max(t.locChanged, 1)) / (c.bugsFoundInQA / Math.max(c.locChanged, 1));
    }

    base.defectRateRatio = (t.bugsFoundInQA / Math.max(t.locWritten || t.locChanged, 1)) / (c.bugsFoundInQA / Math.max(c.locWritten || c.locChanged, 1));
    base.fatigueReduction = c.developerFatigue / Math.max(t.developerFatigue, 1);

    return base;
  }

  async exec(command, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const stdout = execSync(command, { stdio: 'pipe', ...options });
        resolve({ stdout: stdout.toString(), stderr: '' });
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = { BenchmarkRunner };
