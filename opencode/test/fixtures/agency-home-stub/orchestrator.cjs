const fs = require('fs');
const path = require('path');
const outPath = process.env.ORCHESTRATOR_RECEIVED_FILE;
if (outPath) {
    const payload = process.env.AGENCY_TASK_JSON || '{}';
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, payload, 'utf8');
}
process.exit(0);
