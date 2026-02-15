# Cursor Research

## Vibe: The High-Stakes Enterprise Orchestrator

## Last Verified: 2026-02-15 10:30

## Key Facts:
*   **Enterprise Pricing (Mid-Tier 1k EMP):**
    *   **Tier:** "Enterprise" (Custom).
    *   **Teams Tier Reference:** $40 / user / mo. For 1,000 employees, this implies a baseline of **$480,000/year** before enterprise discounts or pooled usage negotiated at the Custom level.
    *   **Features:** Pooled usage, SCIM/SSO, AI code tracking API, and audit logs.
    *   *Source:* [Cursor Pricing](https://cursor.com/pricing)
*   **Data Sovereignty (Score: 4/5):**
    *   **Trust Model:** SOC 2 Type II certified.
    *   **Privacy Mode:** Legally guarantees zero data retention (ZDR) and no training on user code. Enforcement is head-of-org controlled (forcibly enabled for team members).
    *   **Infrastructure:** primarily AWS (US-based). Uses Cloudflare, Azure, and GCP as secondary infrastructure.
    *   *Source:* [Cursor Security](https://cursor.com/security)
*   **Vendor Lock-in (High Risk):**
    *   **Proprietary Core:** While based on a VS Code fork, the "AI orchestration layer" (Parallel Agents, Composer model) is closed-source andproprietary.
    *   **Hard Fork Requirement:** To access flagship v2.0 features (8 parallel agents), developers **must** use the Cursor standalone app. It is not available as a standard VS Code extension.
    *   **Prompt Architecture Lock:** Prompt-building and custom model inference happen exclusively on Cursor's servers (AWS). Even with a "Bring Your Own Key" (BYOK) setup, requests are routed through Cursor's infrastructure; there is no direct-to-provider routing or self-hosted option.
    *   *Source:* [Cursor Security - AI Requests](https://cursor.com/security#ai-requests)
*   **Flexibility (Score: 3/5):**
    *   **IDE Support:** Zero support as a plugin for JetBrains, Visual Studio, or Xcode. It is a **monolithic fork** only. 
    *   **Tooling:** Supports MCP (Model Context Protocol) servers, allowing some extension of the agent's context, but the core environment is fixed.
    *   *Source:* [Cursor Pricing - Compare Plans](https://cursor.com/pricing)
*   **Sustainability & Longevity:**
    *   **Valuation:** $29.3 Billion (as of Nov 2025).
    *   **Funding:** $2.3B Series D.
    *   *Source:* [CNBC - Anysphere Funding](https://www.cnbc.com/2025/11/13/cursor-ai-startup-funding-round-valuation.html)

## Benchmarks:
*   **Productivity:** 2x-3x faster development via 8-way parallel agent execution (Composer model).
*   **Compliance:** SOC 2 Type II.
*   **Sourced Proofs:**
    *   [Cursor Pricing & Plan Breakdown](https://cursor.com/pricing)
    *   [Cursor Security & Infrastructure Audit](https://cursor.com/security)
    *   [CNBC: Anysphere $29.3B Valuation & Series D](https://www.cnbc.com/2025/11/13/cursor-ai-startup-funding-round-valuation.html)
    *   [Cursor 2.0 Feature Docs](https://cursor.com/blog/2-0)

## Score Snapshot (Enterprise Lens):
*   **Longevity/Sustainability:** 5/5 (Massive capital moat)
*   **Sovereignty Score:** 4/5 (Great compliance, but no self-hosting)
*   **Flexibility:** 3/5 (Forced IDE switch is high-friction for 1k teams)
*   **Autonomy:** 5/5 (Market leader in parallel agents)
*   **Vendor Lock-in Risk:** High (Proprietary orchestration + forced fork)
