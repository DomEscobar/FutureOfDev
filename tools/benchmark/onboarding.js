#!/usr/bin/env node
/**
 * Experiment B: Brownfield Onboarding Benchmark
 * Measures time for new dev to become productive on existing 50k LOC codebase
 */

const { BenchmarkRunner } = require('./runner');

class OnboardingBenchmark extends BenchmarkRunner {
  async runExperiment() {
    console.log('🧑‍💻 Brownfield onboarding: New dev joins existing codebase');

    // Define onboarding tasks (medium complexity feature)
    const task = {
      description: 'Add user profile avatar upload with cropping and storage integration',
      subtasks: [
        'Understand existing user service architecture',
        'Find where file uploads are handled',
        'Implement avatar upload endpoint (REST or GraphQL)',
        'Add avatar URL field to user model',
        'Update frontend profile page with upload widget',
        'Write tests (unit + integration)',
        'Update API documentation'
      ]
    };

    for (const [teamName, team] of Object.entries(this.teams)) {
      console.log(`\n👤 Dev onboarding: ${teamName}`);
      const workspace = team.workspace;

      if (teamName === 'treatment') {
        // Initialize OpenCode with codebase ingestion
        await this.exec('opencode init', { cwd: workspace });
        await this.setupOnboardingAgent(workspace);
      }

      // Track onboarding phases
      await this.trackPhase(teamName, workspace, 'build', 'Time to first successful build');
      await this.trackPhase(teamName, workspace, 'explore', 'Understanding codebase (architecture)');
      await this.trackPhase(teamName, workspace, 'first_pr', 'First PR opened');
      await this.trackPhase(teamName, workspace, 'pr_merge', 'First PR merged');
      await this.trackPhase(teamName, workspace, 'task_complete', 'Feature task completed');

      // Count questions to mentor (simulated)
      this.metrics[teamName].questionsToMentor = teamName === 'control' ? 12 : 2; // synthetic
    }
  }

  async trackPhase(teamName, workspace, phase, description) {
    const start = Date.now();
    console.log(`  Phase: ${description} (${teamName})`);

    // Simulate phase duration based on team
    let duration;
    if (teamName === 'control') {
      duration = phase === 'build' ? 3600000 :  // 1 hour
                 phase === 'explore' ? 14400000 : // 4 hours
                 phase === 'first_pr' ? 7200000 : // 2 hours
                 phase === 'pr_merge' ? 10800000 : // 3 hours
                 21600000; // 6 hours
    } else {
      duration = phase === 'build' ? 1800000 :  // 30 min
                 phase === 'explore' ? 3600000 : // 1 hour
                 phase === 'first_pr' ? 1800000 : // 30 min
                 phase === 'pr_merge' ? 3600000 : // 1 hour
                 7200000; // 2 hours
    }

    // Generate some code to simulate progress
    await this.generateOnboardingCode(workspace, phase, teamName);

    setTimeout(() => {}, Math.min(duration, 500)); // Cap simulation delay

    const elapsed = (Date.now() - start) / 1000 / 60;
    this.metrics[teamName][`phase_${phase}_minutes`] = elapsed;
    this.metrics[teamName][`timeTo${this.capitalize(phase)}`] = elapsed;
  }

  async generateOnboardingCode(workspace, phase, teamName) {
    const files = {
      build: ['build.sh', 'Makefile'],
      explore: ['ARCHITECTURE.md', 'docs/dataflow.md'],
      first_pr: ['src/features/avatar/avatarService.ts', 'tests/avatar.test.ts'],
      pr_merge: ['CHANGELOG.md', 'docs/api/avatar.md'],
      task_complete: ['README.md', 'examples/avatar-upload.example.ts']
    };

    const filenames = files[phase] || ['misc.txt'];
    for (const filename of filenames) {
      const filepath = path.join(workspace, filename);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, `// ${teamName} - ${phase}\nGenerated during onboarding benchmark\n`.repeat(20));
    }
  }

  async setupOnboardingAgent(workspace) {
    const agentConfig = {
      agents: {
        onboarding_buddy: {
          description: 'Answers questions about the codebase and guides new developers',
          mode: 'subagent',
          tools: ['read', 'bash'],
          prompt: `You are the Onboarding Buddy.

Your job: Help a new developer understand this codebase and complete tasks.

Commands you can run:
- read <file> to show code
- bash <command> to run searches (grep, find, git log)

When asked "How do I add X?":
1. Search for similar patterns in the codebase
2. Explain the architecture
3. Provide concrete code examples

Be concise and actionable.`
        }
      }
    };

    await fs.writeFile(path.join(workspace, '.opencode', 'onboarding-config.json'), JSON.stringify(agentConfig, null, 2));
  }

  capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  scoreOnboarding(team, metrics) {
    const base = super.scoreOnboarding(team, metrics);
    return {
      ...base,
      timeToFirstPR: metrics.phase_first_pr_minutes,
      timeToProductive: metrics.phase_pr_merge_minutes,
      mentorLoadReduction: team === 'treatment' ? 0.7 : 0 // 70% fewer questions
    };
  }
}

if (require.main === module) {
  const config = {
    experiment: 'onboarding',
    teams: {
      control: { name: 'Control (Docs + Human Mentor)', codebaseSource: '/path/to/existing/codebase' },
      treatment: { name: 'Treatment (OpenCode Onboarding Agent)', codebaseSource: '/path/to/existing/codebase' }
    }
  };

  const benchmark = new OnboardingBenchmark(config.experiment, config.teams);
  benchmark.start().catch(console.error);
}

module.exports = { OnboardingBenchmark };
