# Installed Skills Audit

Status: **pending execution — deferred to the skill-audit pass** · 2026-11-07

This file will inventory agent skills/plugins available to the runtime and classify each as
`portable` / `Claude-Code-specific` / `incompatible`, with the rationale, as required by the master
plan (Phase 3c).

Held because this run is documentation-completion only; a skill audit is an agent-runtime inspection,
not a planning document. **Resolution path:** run the inventory against
`~/.claude/skills`, `~/.claude/plugins/cache`, and any project `.claude/` before the implementation
gate, then fill the table below.

| Skill / plugin | Format | Required tools | Subagent dependence | Model assumptions | Portability | Verdict |
|---|---|---|---|---|---|---|
| *(to be filled)* | | | | | | |

**Standing rule (from the plan):** install nothing unless verified compatible with the configured
DeepSeek-backed gateway **and** necessary. If nothing qualifies, that is stated plainly here.