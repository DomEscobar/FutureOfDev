import subprocess
import json
import os
import sys

class AiderAdapter:
    def __init__(self, config_path):
        with open(config_path, 'r') as f:
            self.config = json.load(f)
        self.cmd = ["aider", "--no-git", "--message"]

    def run_task(self, prompt, context_files):
        # Aider expects files as arguments
        full_cmd = ["aider", "--no-git", "--message", prompt] + context_files
        
        try:
            result = subprocess.run(
                full_cmd,
                capture_output=True,
                text=True,
                check=True
            )
            return {
                "status": "success",
                "output": result.stdout,
                "metrics": {
                    "execution_loop": 1.0, # Placeholder for real timing
                    "code_quality": 0.9    # Placeholder for static analysis
                }
            }
        except subprocess.CalledProcessError as e:
            return {
                "status": "error",
                "error": e.stderr
            }

if __name__ == "__main__":
    # Test stub
    adapter = AiderAdapter("/root/battle/shared/config.json")
    print(json.dumps(adapter.run_task("Hello", []), indent=2))
