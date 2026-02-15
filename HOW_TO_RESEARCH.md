# How to Research and Document AI Coding Assistants

This document outlines the collaborative process for researching and documenting AI coding assistants to ensure our knowledge base is factual, deep, and up-to-date.

## Core Principles
*   **Target Perspective:** All evaluations must be viewed through the lens of a **Mid-Tier $1B+ Company (1,000+ employees)**. Consider scalability, SOC2/compliance, enterprise billing, and organizational security.
*   **Liar-Proof Sourcing (Zero-LLM Knowledge):** NEVER rely on internal model knowledge for facts. Every bullet point MUST be backed by a "Research Click." 
*   **Mandatory Linkage:** Every claim must include the specific source URL where the data was gathered. No link = No Fact.
*   **Post-Developer Trajectory (The Swarm/Jarvis Maturity):** Predict how the tool enables the transition from "Writing Code" to "Orchestrating Intelligence."
    *   **Swarm Density:** Does the tool support massive parallelization of agents (e.g., 50+ background workers)?
    *   **Jarvis-Mode (Personal Sovereignty):** Can the tool be decoupled from the vendor to become a "Personal Agent" that owns the developer's local knowledge graph?
    *   **Orchestration vs. Execution:** Does the tool favor the developer as a "Reviewer" or a "Generator"?

## Key Metrics (Mid-Tier Enterprise Lens)
*   **Agentic Capability (Features & Autonomy):** Evaluate the depth of what the "Agent" can actually do.
    *   **Tooling Access:** Can it use the terminal, browser testing, and git operations autonomously?
    *   **Workflow Integration (Rules/Skills):** Support for custom instructions (e.g., `.cursorrules`, `CLAUDE.md`, or Crush Markdown).
    *   **Parallelization:** Can it run multiple sub-agents or parallel loops to solve complex tasks?
    *   **Verification loops:** Ability to run tests and fix its own errors before presenting code.
*   **Longevity & Sustainability:** Financial stability and parent company backing.
*   **Flexibility (IDE Plugin vs. Monolithic Fork):** This is a critical metric for enterprise compatibility. Does it allow developers to stay in their preferred environment?
    *   **Plugin Availability:** Can it be used as a plugin/extension for VS Code, JetBrains, Visual Studio, Xcode, etc.?
    *   **Hard Fork Status:** Is the move to a "Monolithic Fork" (e.g., Cursor, Windsurf) required for core features?
    *   **Experience Parity:** Do the plugins offer the same "Agentic" power as the standalone forks?
    *   **Potential Vendor Lock-in:** Does it rely heavily on proprietary formats or specific vendor ecosystems (e.g., lock-in to OpenAI models or a specific cloud provider)?
*   **Popularity & Talent Pool:** Is it a tool that new hires already know?
*   **Value-Density:** Token/Credit efficiency for large teams.
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
*   **Data Sovereignty:** Zero-retention availability, training opt-out status, and local-only processing options.
*   **Telemetry Control:** Deep dive into whether the system can run without a constant pulse to the parent server.
*   **Monetization Engine:** Token limits, credit systems, and "unlimited" claims verification.
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
*   **Source Verification:** Always trace claims back to primary sources or highly reputable developer reports. **Record and apply researched links within tool files for auditability.**
*   **Collaboration:** We will work together. I will initiate research, document findings, and prompt for input or verification. You can provide direct feedback, suggest new research angles, or share specific data points.
