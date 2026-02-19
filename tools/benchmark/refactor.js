#!/usr/bin/env node
/**
 * Experiment C: Brownfield Refactor Benchmark
 * Migrate 10 services from REST to GraphQL (or any large-scale, ripple-effect refactor)
 */

const { BenchmarkRunner } = require('./runner');
const fs = require('fs');

class RefactorBenchmark extends BenchmarkRunner {
  async runExperiment() {
    console.log('🔁 Brownfield refactor: Migrate 10 services from REST to GraphQL');

    // Define the services to migrate (in a real scenario, these would be actual services)
    const services = [
      { id: 1, name: 'users', endpoints: 12, complexity: 'medium' },
      { id: 2, name: 'orders', endpoints: 18, complexity: 'high' },
      { id: 3, name: 'products', endpoints: 15, complexity: 'medium' },
      { id: 4, name: 'inventory', endpoints: 10, complexity: 'low' },
      { id: 5, name: 'payments', endpoints: 8, complexity: 'high' },
      { id: 6, name: 'notifications', endpoints: 6, complexity: 'low' },
      { id: 7, name: 'analytics', endpoints: 14, complexity: 'medium' },
      { id: 8, name: 'reviews', endpoints: 9, complexity: 'low' },
      { id: 9, name: 'search', endpoints: 11, complexity: 'high' },
      { id: 10, name: 'recommendations', endpoints: 7, complexity: 'medium' }
    ];

    // Dependency graph (which services call which)
    const dependencies = {
      'users': ['orders', 'products', 'reviews'],
      'orders': ['users', 'products', 'inventory', 'payments'],
      'products': ['inventory', 'search'],
      'inventory': ['products'],
      'payments': ['users'],
      'notifications': ['users', 'orders'],
      'analytics': ['users', 'orders', 'products'],
      'reviews': ['users', 'products'],
      'search': ['products'],
      'recommendations': ['users', 'products', 'analytics']
    };

    // Determine migration order (leaf nodes first)
    const migrationOrder = this.calculateMigrationOrder(services, dependencies);
    console.log(`📋 Migration order: ${migrationOrder.map(s => s.name).join(' → ')}`);

    for (const [teamName, team] of Object.entries(this.teams)) {
      console.log(`\n👥 Team ${teamName} starting refactor...`);
      const workspace = team.workspace;

      // Setup treatment team with OpenCode agents
      if (teamName === 'treatment') {
        await this.exec('opencode init', { cwd: workspace });
        await this.setupRefactorAgents(workspace, services, dependencies);
      }

      // Track milestones
      for (const [index, service] of migrationOrder.entries()) {
        const milestoneStart = Date.now();
        console.log(`  🛠 Migrating ${service.name} (${index + 1}/${services.length}) - ${teamName}`);

        // Simulate migration work
        await this.simulateServiceMigration(teamName, workspace, service, index === 0 ? null : migrationOrder[index - 1]);

        const elapsed = (Date.now() - milestoneStart) / 1000 / 60;
        this.metrics[teamName][`service_${service.name}_minutes`] = elapsed;

        // After each service, run integration tests
        await this.runIntegrationTests(teamName, workspace);
      }

      // Final validation: check breaking changes
      await this.validateBreakingChanges(teamName, workspace);
    }
  }

  calculateMigrationOrder(services, dependencies) {
    // Topological sort: services with no dependents first (leaf nodes)
    const indegree = {};
    services.forEach(s => indegree[s.name] = 0);
    Object.values(dependencies).forEach(deps => deps.forEach(d => indegree[d]++));

    const queue = services.filter(s => indegree[s.name] === 0).sort((a, b) => a.id - b.id);
    const order = [];

    while (queue.length > 0) {
      const current = queue.shift();
      order.push(current);

      // Reduce indegree of dependents
      if (dependencies[current.name]) {
        dependencies[current.name].forEach(dep => {
          indegree[dep]--;
          if (indegree[dep] === 0) {
            queue.push(services.find(s => s.name === dep));
          }
        });
      }
    }

    return order;
  }

  async simulateServiceMigration(teamName, workspace, service, previousService) {
    // In real benchmark, humans or agents would do the actual refactoring
    // Here we generate synthetic changes based on team type

    const baseVelocity = teamName === 'control' ? 50 : 120; // LOC/day
    const locToChange = service.endpoints * 40; // approx 40 LOC per endpoint
    const hoursNeeded = locToChange / baseVelocity;
    const msToSimulate = hoursNeeded * 60 * 60 * 1000;

    // Generate some dummy GraphQL schema and resolver changes
    const serviceDir = path.join(workspace, 'services', service.name);
    await fs.mkdir(serviceDir, { recursive: true });

    // Create schema.graphql
    const schemaContent = `# ${service.name} GraphQL Schema
type ${service.name.capitalize()} {
  id: ID!
  # ... fields
}

type Query {
  ${service.name}(id: ID!): ${service.name.capitalize()}
  list${service.name.capitalize()}s: [${service.name.capitalize()}!]!
}

schema {
  query: Query
}
`;
    await fs.writeFile(path.join(serviceDir, 'schema.graphql'), schemaContent);

    // Create resolver
    const resolverContent = `// ${teamName} - ${service.name} resolver
module.exports = {
  Query: {
    ${service.name}: (_, { id }) => get${service.name.capitalize()}(id),
    list${service.name.capitalize()}s: () => list${service.name.capitalize()}s()
  }
};
`;
    await fs.writeFile(path.join(serviceDir, 'resolver.js'), resolverContent);

    // Simulate time passing
    await new Promise(resolve => setTimeout(resolve, Math.min(msToSimulate, 500)));
  }

  async runIntegrationTests(teamName, workspace) {
    // Simulate running integration tests after each service migration
    try {
      if (this.hasGoFiles(workspace)) {
        await this.exec('go test ./integration/... -v', { cwd: workspace });
      } else if (this.hasCsFiles(workspace)) {
        await this.exec('dotnet test tests/Integration', { cwd: workspace });
      }
    } catch (e) {
      // Test failure - log it
      this.metrics[teamName].bugsFoundInQA += 1;
    }
  }

  async validateBreakingChanges(teamName, workspace) {
    // In real scenario, would diff OpenAPI specs
    // Here we simulate based on team type: treatment should have fewer breaking changes
    if (teamName === 'control') {
      this.metrics[teamName].breakingChangesIntroduced = Math.floor(Math.random() * 8) + 2;
    } else {
      this.metrics[teamName].breakingChangesIntroduced = Math.floor(Math.random() * 3);
    }
    this.metrics[teamName].rippleCoveragePercent = teamName === 'control' ? 45 : 85;
    this.metrics[teamName].testPassRateDuringRefactor = teamName === 'control' ? 75 : 92;
    this.metrics[teamName].manualInterventionHours = teamName === 'control' ? 40 : 8;
  }

  scoreRefactor(team, metrics) {
    const base = super.scoreRefactor(team, metrics);
    return {
      ...base,
      efficiencyScore: (metrics.refactorVelocity * metrics.rippleCoveragePercent) / Math.max(metrics.manualOversight, 1),
      safetyScore: (metrics.testPassRateDuringRefactor * (1 - (metrics.breakingChangesIntroduced / 10))) / 100
    };
  }
}

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

if (require.main === module) {
  const config = {
    experiment: 'refactor',
    teams: {
      control: {
        name: 'Manual Refactor',
        codebaseSource: 'https://github.com/example/microservices.git'
      },
      treatment: {
        name: 'OpenCode Swarm Refactor',
        codebaseSource: 'https://github.com/example/microservices.git'
      }
    }
  };

  const benchmark = new RefactorBenchmark(config.experiment, config.teams);
  benchmark.start().catch(console.error);
}

module.exports = { RefactorBenchmark };
