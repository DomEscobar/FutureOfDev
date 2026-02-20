# Benchmark Scorecard Template
**Experiment:** [Greenfield Sprint | Brownfield Onboarding]
**Date:** YYYY-MM-DD
**Teams:** Control vs. Treatment

---

## 🎯 Primary Metrics

| Metric | Control | Treatment | Advantage | Target |
| :--- | :--- | :--- | :--- | :--- |
| **Time to MVP** (min) | | | TBD (≥ 2× faster) | |
| **Velocity** (LOC/hour) | | | TBD | |
| **Time to First PR** (min) | | | TBD (≥ 50% faster) | |
| **Test Coverage** (%) | | | ≥ 70% (no penalty) | |
| **Architectural Violations** (#) | | | ≤ 5 | |
| **QA Bugs Post-merge** (#) | | | ≤ 10% of LOC/1000 | |
| **Questions to Mentor** (#) | | | ≥ 70% reduction | |
| **PR Success Rate** (%) | | | ≥ 90% first try | |

---

## 📊 Secondary Metrics

| Category | Control Observations | Treatment Observations |
| :--- | :--- | :--- |
| **Developer Fatigue** (1-10) | | |
| **Context Switching** (hrs/day) | | |
| **Tool Switching** (count) | | |
| **Manual Intervention** (hrs) | | |
| **AI Confidence** (1-10) | N/A | |

---

## 🏆 Qualitative Assessment

### Control Team Notes
- What slowed them down?
- What manual patterns emerged?
- Architectural decisions made?

### Treatment Team Notes
- How did OpenCode agents help?
- What friction remained?
- Self-optimizing behaviors observed?

---

## 🧪 Experimental Validity

| Check | Status | Notes |
| :--- | :--- | :--- |
| **Teams balanced** (skill level) | ☐ | |
| **Task identical** for both teams | ☐ | |
| **No external interference** | ☐ | |
| **Metrics collection automated** | ☐ | |
| **Blind review** (if applicable) | ☐ | |

---

## 📈 Advantage Calculation

```javascript
// Velocity Advantage
const velocityRatio = treatment.locWritten / treatment.timeTotal / (control.locWritten / control.timeTotal);

// Onboarding Speedup
const speedup = control.timeTotal / treatment.timeTotal;

// Defect Rate
const defectRatio = (treatment.bugsFoundInQA / treatment.locWritten) / (control.bugsFoundInQA / control.locWritten);
```

---

## ✅ Success Criteria

- **Greenfield:** Treatment achieves **≥ 2× velocity** with **≤ 10% lower test coverage**.
- **Onboarding:** Treatment reaches "independent contributor" status **≥ 50% faster**.
- **Overall:** Treatment reports **≤ 5/10 fatigue** vs. Control **≥ 7/10**.

---

**Judges' Signature:** _______________________
**Date:** _______________________
