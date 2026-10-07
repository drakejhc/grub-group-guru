# Vendored Claude Code skills

Copied from public upstream repos, trimmed to fit this React + TypeScript + Supabase (Vite) app.

| Path | Upstream | Notes |
|---|---|---|
| `skills/vercel-react-best-practices/` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/react-best-practices` (MIT) | Dropped the 108KB `AGENTS.md` bundle; per-rule files in `rules/` kept. Many `server-*` rules are Next.js-specific and don't apply to this Vite app. |
| `skills/web-design-guidelines/` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines` (MIT) | Fetches the latest rules from `vercel-labs/web-interface-guidelines` at review time, so it needs network access. |
| `skills/tdd/` | [mattpocock/skills](https://github.com/mattpocock/skills) `skills/engineering/tdd` | `LICENSE` included. References sibling skills (`codebase-design`, `code-review`) that are not vendored. |
| `agents/code-simplifier.md` | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) `plugins/code-simplifier` | Subagent, not a skill. License in `agents/code-simplifier.LICENSE`. |

Not vendored: superpowers, spartan-ai-toolkit, planetscale, TerraShark, doc-coauthoring (plugin-based or not relevant to this stack).
