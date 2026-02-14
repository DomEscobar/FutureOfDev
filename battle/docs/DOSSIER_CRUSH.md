# Crush Dossier — AI Code Assistant (Feb 2026)

**Repo**: `charmbracelet/crush`  
**Language**: Go  
**License**: FSL-1.1-MIT (Other)  
**Stars**: 19,946 | **Forks**: 1,231 | **Open Issues**: 316  
**Created**: 2025-05-21 | **Last Push**: 2026-02-13

## Forensic Summary

- **Origin**: Charm organization (Bracelet ecosystem: Bubble Tea, Lip Gloss)
- **Model**: Terminal-native TUI agent; sessions + LSP + MCP extensibility
- **Adoption**: Industrial-grade claims (“25k+ applications”)
- **Governance**: Community-driven merges; org members active; founder commits 0

## Strategic Moat

1. **LSP Integration** — Uses language servers for codebase context (like a human)
2. **MCP Support** —stdio/http/sse — plug in external tools and data sources
3. **Multi-Provider Flexibility** — OpenAI, Anthropic, Groq, OpenRouter, local (Ollama, LM Studio), Bedrock, Vertex AI
4. **AgentSkills.io compatibility** — extensible skill packages
5. **Session-based contexts** — multiple project contexts; switch LLMs mid-session
6. **Cross-platform TUI** — macOS, Linux, Windows (PowerShell/WSL), BSDs, Android
7. **Ecosystem lock-in** —Built on Bubble Tea (battle-tested TUI framework)

## Known Weaknesses

- Performance issues on certain filesystems (mounted volumes cause CPU spikes)
- Provider-specific bugs: GLM-5 context limit mis-detection, MiniMax 2.5 support
- Smaller core team; dependency on community contributors
- License “NOASSERTION” may raise legal clarity questions for some enterprises

## Verdict & Multiplier

**Multiplier**: `0.85` (baseline)

Crush is not yet battle-tested at scale vs established tools, but its unique combination of LSP+MCP+multi-provider in a terminal-native package gives it a strong, defensible niche. Risk: absorbed or forked. Upside: becomes the standard CLI agent for power users by 2027.

## Adapter

Path: `./adapters/crush.py` (to be implemented)
