# Crush.ai Research

## Vibe: The Glamorous Terminal Orchestrator

## Last Verified: 2026-02-15 11:45

## Key Facts:
*   **Background:** Crush is an **open-source, terminal-first AI coding agent** developed by **Charm** (Charmbracelet, Inc.), known for high-quality TUI (Terminal User Interface) tools like Bubble Tea and Glow.
*   **Enterprise Pricing (Mid-Tier 1k EMP):**
    *   **Core Software:** **Free & Open Source** (FSL-1.1-MIT License).
    *   **Commercial Support:** Charm offers "Industrial Grade" tiers for business-critical infrastructure, focusing on dedicated support and custom integrations.
    *   **Usage Model:** Developers bring their own LLM keys or use local models. No mandatory seat-based licensing for the core tool.
    *   *Source:* [Charm.land - Crush](https://charm.land/) / [Crush GitHub](https://github.com/charmbracelet/crush)
*   **Data Sovereignty (Score: 5/5):**
    *   **Self-Hosting:** 100% open source. High-compliance enterprises can audit the code and run it entirely in air-gapped terminal environments.
    *   **No Data Retention:** Facilitates direct communication between the developer's terminal and their chosen LLM provider (or local model). Charm does not sit in the middle of the code stream.
    *   *Source:* [Crush GitHub - Privacy Philosophy](https://github.com/charmbracelet/crush)
*   **Vendor Lock-in (Zero Risk):**
    *   **Model Arbitrage:** Supports any model compatible with their provider interface (OpenAI, Anthropic, Gemini, local Ollama). Support for **75+ LLM providers** through local configuration.
    *   **Environment:** Runs in any terminal. No lock-in to a specific IDE binary.
    *   *Source:* [Charm.sh - Ecosystem](https://charm.land/)
*   **Flexibility (Score: 5/5):**
    *   **IDE Support:** **Infinite Flexibility.** As a CLI/TUI tool, it runs alongside VS Code, JetBrains, Vim, or Xcode. It does not require developers to switch editors.
    *   **Context Aware:** Uses LSPs (Language Server Protocol) and MCP (Model Context Protocol - http, stdio, sse) to index and understand the codebase.
    *   *Source:* [Crush Documentation](https://github.com/charmbracelet/crush)
*   **Agentic Capability (Score: 5/5):**
    *   **Tooling Access:** First-class terminal/bash support, git integration, and out-of-the-box LSP code completion.
    *   **Workflow Integration:** Supports Agent Skills and project-specific contexts via `AGENTS.md` (or custom markdown).
    *   **Verification loops:** Includes tool-call loop detection and multi-session work contexts per project.
    *   *Source:* [Crush GitHub - Features](https://github.com/charmbracelet/crush#features)
*   **Stack Transparency (OSS Tech Stack):**
    *   **Language:** Primarily **Go** (96.7%).
    *   **Runtime:** Compiled binary (single file). Highly performant and easy to distribute.
    *   **Orchestration:** Built on top of the **Charm ecosystem** (Bubble Tea, Lip Gloss, etc.) for a glamorous TUI experience.
    *   *Source:* [Crush GitHub Languages](https://github.com/charmbracelet/crush)
*   **Sustainability & Longevity:**
    *   **Community:** Backed by Charm's massive community (**191k+ Stars** across the ecosystem). Crush specifically has surged to **20k Stars**.
    *   *Source:* [Charm Metrics](https://charm.land/)

## Score Snapshot (Enterprise Lens):
*   **Longevity/Sustainability:** 4/5 (VC backed but community-driven infrastructure)
*   **Sovereignty Score:** 5/5 (Auditable, private terminal execution)
*   **Flexibility:** 5/5 (CLI-native, works with every IDE/workstation)
*   **Autonomy:** 5/5 (Parallel agents and LSP integration)
*   **Vendor Lock-in Risk:** Zero (Open source and model-agnostic)
