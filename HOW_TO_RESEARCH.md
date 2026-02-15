# How to Research and Document AI Coding Assistants

This document outlines the collaborative process for researching and documenting AI coding assistants to ensure our knowledge base is factual, deep, and up-to-date.

## Core Principles
*   **Focus on Deep Dive Facts:** Prioritize unique features, proprietary architecture, specific performance metrics, and capabilities that go beyond surface-level marketing. Avoid common knowledge or widely known features unless they are critical to a specific differentiator.
*   **Concise and Clean:** Content should be factual, bullet-pointed, and free of fluff. Aim for high signal-to-noise ratio.
*   **Benchmarking is Key:**
    *   **Speed & Performance:** Document measurable speed differences, latency observations, and any local or browser-lab benchmarking results. Compare how systems feel faster or slower.
    *   **Platform Benchmarks:** Explicitly reference OpenClaw and Forge Labs capabilities and limitations as benchmarks where relevant. How does a tool integrate with or perform against these platforms?
*   **Structured Data:** Utilize consistent templates for research files (`research/*.md`) and the main `COMPARISON_MATRIX.md` for scoring and direct comparison.

## Research Workflow

### Phase 1: Tool Identification & Initial Scan
1.  Identify target AI coding assistant.
2.  Perform initial web search using `research-browser-camofox` or similar specialized tools to bypass bot detection.
3.  Quickly scan for official documentation, recent articles (post-2025), and developer communities for key differentiators.

### Phase 2: Deep Dive & Fact Gathering (Per Tool)
1.  For each tool, create/update its dedicated markdown file in `/FutureOfDev/research/`.
2.  **Document `Vibe:`:** A single, evocative phrase capturing the tool's essence (e.g., "Pure Power/Precision," "Flow/Agentic Autonomy").
3.  **Record `Last Verified:`:** Timestamp of the last significant update or verification (YYYY-MM-DD HH:MM).
4.  **List `Key Facts:`:**
    *   Proprietary technologies or unique algorithms.
    *   Specific integration points (e.g., MCP support, VS Code fork details).
    *   Advanced features not commonly found elsewhere.
    *   Any reported limitations or circumvention strategies for bot detection.
5.  **Detail `Benchmarks:`:**
    *   Reported speed metrics, latency figures.
    *   Results from local or browser-lab tests.
    *   Comparisons to OpenClaw, Forge Labs, or other benchmark systems.
    *   Notes on how speed/performance is perceived or measured.
6.  **`Score Snapshot:`** Assign scores (1-5) for:
    *   Reasoning
    *   Autonomy
    *   Speed
    *   Context Handling
    *   Developer Experience (DX)
    *   (Add other relevant metrics as they emerge)

### Phase 3: Aggregation & Comparison
1.  Update `COMPARISON_MATRIX.md` on the root level.
2.  Aggregate scores from individual tool files into the comparison table.
3.  Add a section for `Speed Benchmarking Notes` summarizing performance findings across all tools.
4.  Include a `General Observations` section for overarching insights.

### Updating & Maintenance
*   **Regular Cadence:** Schedule periodic checks (e.g., weekly/bi-weekly) for significant AI tool updates.
*   **Source Verification:** Always trace claims back to primary sources or highly reputable developer reports.
*   **Collaboration:** We will work together. I will initiate research, document findings, and prompt for input or verification. You can provide direct feedback, suggest new research angles, or share specific data points.
