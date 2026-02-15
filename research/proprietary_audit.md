# Remaining Tools: Enterprise Audit (2026)

## target-company-size: 1,000 Employees ($1B+ Mid-Tier)

---

## 1. Windsurf (Codeium)
### Vibe: The "Flow-State" Monolith
*   **Enterprise Pricing:**
    *   **Tier:** "Enterprise".
    *   **Cost:** ~$60/user/mo (estimated from mid-2025 data). For 1k employees, this is a **$720,000/year** run rate.
    *   **Billing:** Custom contract with seat-based and flexible deployment options.
*   **Data Sovereignty (Score: 3/5):**
    *   **Deployment:** Offers SaaS, VPC, and **Air-Gapped** on-prem options.
    *   **Privacy:** SOC 2 Type II compliant. Claims "No training on user code."
    *   *Source:* [Windsurf Enterprise Specs](https://windsurf.com/enterprise)
*   **Flexibility & Vendor Lock (Score: 4/5):**
    *   **IDE Support:** **Hard Fork (Windsurf Editor)** is required for the full agentic "Cascade" flow. 
    *   **Plugin Availability:** While standard Codeium plugins exist for 40+ IDEs, they lack the multi-file agentic power of the fork.
    *   **Vendor Lock-in:** High IDE lock-in if adopting Cascade workflows.
*   **Agentic Capability:**
    *   **Cascade Flow:** High autonomy in multi-file edits and terminal control.
    *   *Source:* [Codeium/Windsurf Pricing](https://windsurf.com/pricing)

---

## 2. GitHub Copilot
### Vibe: The Corporate Standard
*   **Enterprise Pricing:**
    *   **Tier:** "Enterprise".
    *   **Cost:** **$39/user/mo** ($468/user/yr list). For 1k employees, this is **$468,000/year**.
    *   **Consumptive Billing:** Shifted toward monthly allowances for "Premium Requests" (e.g., using GPT-o models or advanced indexing).
*   **Data Sovereignty (Score: 5/5):**
    *   **Infrastructure:** Azure-grade isolation. FedRAMP and SOC 2 Type II. Enterprise Managed Users (EMU) allow the company to own the identity entirely.
    *   *Source:* [GitHub Pricing](https://github.com/pricing)
*   **Flexibility & Vendor Lock (Score: 4/5):**
    *   **IDE Support:** **Excellent (Plugin-based).** Works in VS Code, JetBrains, Visual Studio, and Vim as an extension. No hard fork required.
    *   **Vendor Lock-in:** High ecosystem lock-in to GitHub/Azure. Difficult to use effectively if using GitLab/Bitbucket at the 1k EMP scale.
*   **Agentic Capability:** 
    *   **Autopilot:** Improving agents for PR fixing and security autofix, but historically lags behind Cursor/OpenCode in pure terminal-autonomy.
    *   *Source:* [GitHub Copilot Enterprise Docs](https://docs.github.com/en/enterprise-cloud@latest/copilot/github-copilot-enterprise/)

---

## 3. Tabnine
### Vibe: The Security Fortress
*   **Enterprise Pricing:**
    *   **Cost:** **$59/user/mo** (Annual). For 1k employees, this is **$708,000/year**.
    *   **Unlimited Model-use:** Unlimited usage if using your own LLM or on-prem. Token quotas apply if using Tabnine-provided cloud LLMs.
*   **Data Sovereignty (Score: 5/5):**
    *   **The differentiator:** Optimized for **100% On-Prem and Air-Gapped** deployments. Zero Code Retention (ZDR) is the default.
    *   *Source:* [Tabnine Pricing](https://www.tabnine.com/pricing/)
*   **Flexibility & Vendor Lock (Score: 5/5):**
    *   **IDE Support:** **Plugin-first.** Works in all major IDEs. No hard fork required.
    *   **Vendor Lock-in:** **Low.** Supports model arbitrage (OpenAI, Anthropic, Google, Meta, local) and isn't tied to a specific cloud or git provider.
    *   *Source:* [Tabnine Platform](https://www.tabnine.com/platform/)
