# Frontend Implementation Steps: Prompt Compost + Git Hook Guardian

**Goal:** Reduce repetitive prompting and enforce commit hygiene automatically.

---

## 🎯 Phase 1: Prompt Compost (Week 1–2)

### Step 1.1: Identify Repetitive Patterns
Log every time you write a similar prompt for:
- Creating a new React/Vue component
- Adding a form field
- Writing a test

Create `FRICTION_LOG.md` entries:
```
[2026-02-19] "Create a button with loading state" - repeated 8 times
[2026-02-19] "Write a test for LoginForm" - repeated 5 times
```

### Step 1.2: Build the Template Engine
**`tools/prompt-compost/templates/`**:
```
component.hbs
  {{name}}Component with loading state, error handling, and TypeScript props.
  Uses your project's design system (Radix UI / Shadcn).
  exports { default as {{name}} } from './{{name}}.tsx'

form-field.hbs
  A form field for {{fieldName}} with validation using Zod.
  Includes label, error message, and proper ARIA attributes.
```

**`tools/prompt-compost/generate.js`**:
```javascript
#!/usr/bin/env node
const fs = require('fs');
const handlebars = require('handlebars');

const templateName = process.argv[2];
const context = JSON.parse(process.argv[3] || '{}');

const template = handlebars.compile(
  fs.readFileSync(`templates/${templateName}.hbs`, 'utf8')
);

console.log(template(context));
```

### Step 1.3: Create CLI Wrapper
**`tools/prompt-compost/cli.js`**:
```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');

const [_, __, type, name] = process.argv;

// 1. Generate scaffold from template
const content = execSync(`node generate.js ${type} '{"name":"${name}"}'`).toString();

// 2. Write file
fs.writeFileSync(`${type}s/${name}.${extensionFor(type)}`, content);

// 3. Optionally, open in editor
console.log(`✅ Generated ${name} from ${type} template`);
```

**Make it executable:**
```bash
chmod +x tools/prompt-compost/cli.js
npm link # global install
```

**Usage:**
```bash
prompt-compost component SubmitButton
prompt-compost form-field email
```

---

## 🔧 Phase 2: Git Hook Guardian (Week 3)

### Step 2.1: Define Your Checklist
Create `.commitlintrc.js` or a simple script:
```javascript
// scripts/commit- Checklist.js
const checklist = [
  "Tests added/updated?",
  "Docs updated?",
  "No console.log?",
  "No secrets committed?"
];

module.exports = checklist;
```

### Step 2.2: Pre-commit Hook Script
**`.git/hooks/pre-commit`**:
```bash
#!/bin/bash
# Run the checklist
node scripts/commit-checklist.js

# Auto-fix common issues
npx eslint --fix
npx prettier --write .

# Check for console.log
if git diff --cached | grep -q "console\.log"; then
  echo "❌ Remove console.log statements"
  exit 1
fi

# Check for secrets
if git diff --cached | grep -q -E "(API_KEY|SECRET|PASSWORD)="; then
  echo "❌ Potential secret detected. Use environment variables."
  exit 1
fi
```

### Step 2.3: Integrate with OpenCode Agent
**`.opencode/agents/pre-commit-guardian.md`**:
```yaml
description: Enforces commit hygiene and auto-fixes trivial issues
mode: subagent
tools:
  bash: true
permission:
  bash:
    "git diff": allow
    "eslint *": allow
    "prettier *": allow
prompt: |
  You are the Pre-Commit Guardian.
  Before each commit:
  1. Run lint and fix auto-fixable issues.
  2. Remove console.log statements.
  3. Check for hardcoded secrets.
  4. If issues found, fix them and stage changes.
  5. If clean, approve commit.
```

---

## 🤖 Phase 3: Swarm Integration (Week 4)

### Step 3.1: Combine Patterns
Now your frontend workflow:
1. `prompt-compost component MyButton` → generates perfect component.
2. Code, then `git commit`.
3. Pre-commit hook triggers `@pre-commit-guardian`.
4. Guardian runs lint, removes console, checks secrets → auto-stages fixes.
5. You only review the final diff; commit is clean.

### Step 3.2: Metrics Dashboard
Create `FRONTEND_FRICTION_LOG.md` tracking:
- Time saved per component generation (vs. manual prompting).
- Number of console.log auto-removals.
- Pre-commit failures prevented.

---

## 📈 Success Metrics

| Metric | Target (Week 4) | How to Measure |
| :--- | :--- | :--- |
| **Prompt Reduction** | 70% fewer similar prompts | Compare `FRICTION_LOG.md` entries |
| **Commit Cleanliness** | 90% of commits pass pre-commit first try | CI logs |
| **Time Saved** | 2+ hours/week | Self-reported |

---

## 🚀 Next Steps

After Prompt Compost + Git Hook Guardian are stable:
1. **Component Playground** (live contract testing)
2. **Lazy-Load Analyzer** (bundle optimization)
3. **A11y Auditor** (automated WCAG scans)

**Start with Step 1.1** — log your frictions today.
