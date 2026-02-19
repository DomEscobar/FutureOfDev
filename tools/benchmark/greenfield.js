#!/usr/bin/env node
/**
 * Experiment A: Greenfield Sprint Benchmark
 * Compares human-only vs. AI-augmented (OpenCode) full-stack SaaS development
 */

const { BenchmarkRunner } = require('./runner');
const fs = require('fs');

class GreenfieldBenchmark extends BenchmarkRunner {
  async runExperiment() {
    console.log('🏗️ Greenfield sprint: Build MVP SaaS (auth + billing + CRUD)');

    // Define feature milestones
    const milestones = [
      { name: 'Project scaffolding', locTarget: 200, maxDays: 1 },
      { name: 'Auth flow', locTarget: 300, maxDays: 2 },
      { name: 'Billing integration', locTarget: 400, maxDays: 3 },
      { name: 'Core CRUD', locTarget: 600, maxDays: 5 },
      { name: 'Tests ≥ 70%', locTarget: 0, maxDays: 7 }
    ];

    for (const [teamName, team] of Object.entries(this.teams)) {
      console.log(`\n📋 Team ${teamName} starting...`);
      const workspace = team.workspace;

      // Set up team-specific configuration
      if (teamName === 'treatment') {
        // Initialize OpenCode for treatment team
        await this.exec('opencode init', { cwd: workspace });
        await this.writeOpencodeConfig(workspace, team);
      }

      // Milestone tracking
      for (const milestone of milestones) {
        console.log(`  → ${milestone.name} (${teamName})`);
        const milestoneStart = Date.now();

        // Simulate work (in real benchmark, humans would do this)
        // Here we'll generate dummy activity based on team type
        await this.simulateMilestone(teamName, workspace, milestone);

        const elapsed = (Date.now() - milestoneStart) / 1000 / 60;
        this.metrics[teamName][`milestone_${milestone.name.replace(/\s/g, '_')}_minutes`] = elapsed;

        // Check if milestone exceeded time budget
        if (elapsed > milestone.maxDays * 24 * 60) {
          console.warn(`⚠️  ${teamName} took ${elapsed}m (budget ${milestone.maxDays * 24 * 60}m)`);
        }
      }
    }
  }

  async simulateMilestone(teamName, workspace, milestone) {
    // In a real benchmark, this would be actual development work.
    // For prototype, we generate synthetic data based on known velocity ratios.

    const baseVelocity = teamName === 'control' ? 30 : 75; // LOC/hour
    const hoursNeeded = milestone.locTarget / baseVelocity;
    const msToSimulate = hoursNeeded * 60 * 60 * 1000;

    // Write some dummy files to increase LOC count
    const numFiles = Math.max(1, Math.floor(milestone.locTarget / 50));
    for (let i = 0; i < numFiles; i++) {
      const content = `// ${teamName} - ${milestone.name}\n`;
      await fs.appendFile(path.join(workspace, `generated_${i}.js`), content.repeat(50));
    }

    // Simulate time passing (in real benchmark, this is actual work time)
    await new Promise(resolve => setTimeout(resolve, Math.min(msToSimulate, 1000)));
  }

  async writeOpencodeConfig(workspace, team) {
    const config = {
      agents: {
        architect: {
          description: 'Enforces modular architecture and module boundaries',
          mode: 'subagent',
          prompt: 'You are the architect. Review PRs for architectural consistency. Ensure no circular dependencies.'
        },
        builder: {
          description: 'Generates boilerplate code following project conventions',
          mode: 'subagent',
          prompt: 'You are the builder. Generate features using the established patterns.'
        }
      }
    };

    await fs.mkdir(path.join(workspace, '.opencode'), { recursive: true });
    await fs.writeFile(path.join(workspace, '.opencode/config.json'), JSON.stringify(config, null, 2));
  }

  scoreGreenfield(team, metrics) {
    const base = super.scoreGreenfield(team, metrics);
    // Add greenfield-specific scores
    return {
      ...base,
      mvpCompleteness: this.calculateMVPScore(team),
      architecturalConsistency: this.estimateArchConsistency(team)
    };
  }

  calculateMVPScore(team) {
    // Simplified: based on milestone completion
    const milestones = ['Project_scaffolding', 'Auth_flow', 'Billing_integration', 'Core_CRUD', 'Tests_≥_70%'];
    // In real benchmark, check actual feature completion
    return team === 'treatment' ? 0.9 : 0.4; // synthetic scores
  }

  estimateArchConsistency(team) {
    // In real benchmark, analyze code for pattern diversity
    return team === 'treatment' ? 0.85 : 0.6;
  }
}

// Run
if (require.main === module) {
  const config = {
    experiment: 'greenfield',
    teams: {
      control: { name: 'Control (Human Only)', templateRepo: 'https://github.com/example/saas-template.git' },
      treatment: { name: 'Treatment (OpenCode Forge)', templateRepo: 'https://github.com/example/saas-template.git' }
    }
  };

  const benchmark = new GreenfieldBenchmark(config.experiment, config.teams);
  benchmark.start().catch(console.error);
}

module.exports = { GreenfieldBenchmark };
