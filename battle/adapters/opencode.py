import subprocess
import json
import os

class OpenCodeAdapter:
    def __init__(self, config_path):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        # OpenCode (Anomaly) is Bun/Node based.
        self.base_cmd = ["opencode", "-q", "-f", "json"]

    def run_task(self, prompt, context_files=None):
        # OpenCode uses the same system-wide context protocol we audited
        full_cmd = self.base_cmd + ["-p", prompt]
        
        try:
            # Capturing the official JSON output for automated battle scoring
            result = subprocess.run(
                full_cmd,
                capture_output=True,
                text=True,
                check=True
            )
            return {
                "status": "success",
                "output": result.stdout,
                "strategic_advantage": "GitHub/Copilot Partnership Meta",
                "multiplier": 0.95
            }
        except subprocess.CalledProcessError as e:
            return {
                "status": "error",
                "error": e.stderr
            }

if __name__ == "__main__":
    adapter = OpenCodeAdapter("/root/battle/shared/config.json")
    # Arena Pre-run verification
    print(json.dumps(adapter.run_task("Verify system architecture"), indent=2))
