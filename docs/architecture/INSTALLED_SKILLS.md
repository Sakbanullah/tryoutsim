# Installed Skills Audit

Status: **executed** · 2026-11-08

Inventory of agent skills/plugins available to the runtime, classified as `portable` /
`Claude-Code-specific` / `incompatible`. Gate 1 item of
[DEVELOPMENT_ROADMAP](../roadmap/DEVELOPMENT_ROADMAP.md).

Sources inspected: `~/.claude/skills/`, `~/.claude/plugins/installed_plugins.json`,
`~/.claude/plugins/cache/`, project `.claude/settings.json`.

| Skill / plugin | Format | Required tools | Subagent dependence | Model assumptions | Portability | Verdict |
|---|---|---|---|---|---|---|
| `graphify` (user skill) | `SKILL.md` + `references/` | file read/search; shell for the graph CLI | none | none | portable | required by [AGENTS.md](../../AGENTS.md) — keep |
| `superpowers` 6.4.2 (plugin) | plugin, skills + subagents | Claude Code tool names, Skill/Agent tools | heavy (brainstorming, executing-plans, subagent-driven-development) | assumes Claude-family tool protocol | Claude-Code-specific | keep for Claude Code sessions; not a product dependency |
| `frontend-design` 1.1.1 (plugin, project-scope on this repo) | plugin skill | file read/write | none | none | portable | keep; design guidance only |
| `browser-automation` (symlink to `~/.codegpt/skills/`) | skill | browser driver | none | none | Claude-Code-specific (host-provided symlink) | optional |

**Standing rule (from the plan):** install nothing unless verified compatible with the configured
DeepSeek-backed gateway **and** necessary.

**Verdict:** no runtime skill is a dependency of TryoutSim itself. The app ships no agent skills, so
nothing in the installed set is required for the backend gate. No new install is proposed.
