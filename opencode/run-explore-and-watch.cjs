#!/usr/bin/env node
/**
 * Run hyper-explorer MCP, then player-finding-watcher. New findings trigger the agency.
 *
 * Usage:
 *   node run-explore-and-watch.cjs [URL]                    # explorer default goal, then watcher --once
 *   node run-explore-and-watch.cjs [URL] --journeys         # all journeys from user-journey.md, then watcher --once
 *   node run-explore-and-watch.cjs [URL] --yolo             # full yolo: --journeys --max-steps 20, then watcher daemon (watch agency fix each finding)
 *   node run-explore-and-watch.cjs [URL] goal1 goal2        # specific goals
 *
 * Env: AGENCY_HOME. Watcher workspace from roster/player/memory/watcher_config.json.
 */

const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname);
const AGENCY_HOME = process.env.AGENCY_HOME || ROOT;
const defaultUrl = 'http://localhost:5173';

function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const c = spawn(cmd, args, {
            cwd: opts.cwd || ROOT,
            stdio: 'inherit',
            env: { ...process.env, ...opts.env }
        });
        c.on('close', code => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
        c.on('error', reject);
    });
}

async function main() {
    const args = process.argv.slice(2);
    const url = args[0] || defaultUrl;
    const rest = args.slice(1);
    const yolo = rest.includes('--yolo');
    const useJourneys = yolo || rest.includes('--journeys');
    const maxSteps = yolo ? 20 : (rest.includes('--max-steps') ? parseInt(rest[rest.indexOf('--max-steps') + 1]) || 8 : 8);
    const goals = rest.filter(x => !x.startsWith('--') && x !== '20');

    console.log('[run-explore-and-watch] Phase 1: Explorer');
    if (yolo) console.log('  Mode: FULL YOLO (--journeys, --max-steps 20)');
    console.log(`  URL: ${url}  Goals: ${useJourneys ? '(from user-journey.md)' : goals.length ? goals.join(', ') : 'explore_max_coverage (default)'}  MaxSteps: ${maxSteps}`);

    const explorerArgs = [path.join(ROOT, 'hyper-explorer', 'src', 'hyper-explorer-mcp.mjs'), url];
    if (useJourneys) explorerArgs.push('--journeys');
    if (maxSteps !== 8) explorerArgs.push('--max-steps', String(maxSteps));
    if (goals.length && !useJourneys) explorerArgs.push(...goals);

    try {
        await run('node', explorerArgs, { env: { AGENCY_HOME } });
    } catch (e) {
        console.error('[run-explore-and-watch] Explorer finished:', e.message);
    }

    const watchOnce = !yolo;
    console.log('\n[run-explore-and-watch] Phase 2: Watcher' + (watchOnce ? ' (--once)' : ' (daemon — watch agency fix each finding, Ctrl+C to stop)'));
    const watcherArgs = [path.join(ROOT, 'player-finding-watcher.cjs')];
    if (watchOnce) watcherArgs.push('--once');
    watcherArgs.push('--no-semantic-dedup');
    try {
        await run('node', watcherArgs, { env: { AGENCY_HOME } });
    } catch (e) {
        if (e.message && !e.message.includes('exit')) console.error('[run-explore-and-watch] Watcher:', e.message);
        process.exitCode = watchOnce ? 1 : 0;
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
