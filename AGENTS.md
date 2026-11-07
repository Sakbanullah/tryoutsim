# AGENTS.md

Working agreement for every agent (human and AI) contributing to TryoutSim. This file is the
authoritative process contract for this repository; it overrides default behaviour.

## Mission

A local-first, single-user, AI-assisted CPNS SKD preparation app. The **official SKD structure** is
faithful; the **product** (question generation, analytics, recommendations) is what makes it a study
tool, not a leak of the real exam.

## Non-negotiable constraints

1. **No fabricated regulation.** Never invent a CPNS 2026 rule, threshold, legal basis, endpoint
   behaviour, or business rule without a documented source. Every claim has an evidence tier
   (`VERIFIED-2026`, `VERIFIED-CURRENT`, `HISTORICAL`, `VERIFIED-ABSENCE`, `UNVERIFIED`) and a
   source. See [docs/examination/CPNS_2026_REGULATIONS.md](docs/examination/CPNS_2026_REGULATIONS.md).
2. **Pathway separation.** Sekolah Kedinasan rules (`Kepmen PANRB 406/2026`) are never cited as CPNS
   2026 authority. They are a different pathway.
3. **No silent approval drift.** A `provisional` config is not scorable until approved, and any
   change to the four bound values (`configVersion`, `scoringVersion`, `regulatoryBasisHash`,
   `configId`) forces re-approval. See [docs/examination/SCORING_METHODOLOGY.md](docs/examination/SCORING_METHODOLOGY.md) §11.
4. **Scoring is a pure function** over (answers, frozen session snapshot, scoringVersion). No clocks,
   no network, no live config. Integers only.
5. **Frontend renders, never recomputes.** The UI displays backend-contract data; scores, metrics
   and percentages are never re-derived on the client.
6. **Secrets are write-only.** Provider API keys are stored by reference, shown as `keyLast4`, never
   in logs, responses, bundles, or docs.
7. **No implementation without approval.** Frontend and backend source are gated behind explicit
   user approval at each phase. See [docs/roadmap/DEVELOPMENT_ROADMAP.md](docs/roadmap/DEVELOPMENT_ROADMAP.md).

## Phase order (enforced)

discovery → research → docs → audit → **STOP and report**

Only after the user approves the documentation set do the implementation gates open, and in this
order: frontend (mock data) → backend. See the roadmap for the gate-by-gate definition.

## Canonical docs (single source of truth, no duplication)

| Domain | Canonical doc |
|---|---|
| Scoring/benchmarks/snapshots | `docs/examination/SCORING_METHODOLOGY.md` |
| CPNS 2026 regulations/evidence | `docs/examination/CPNS_2026_REGULATIONS.md` |
| Questions/lifecycle/validation | `docs/examination/QUESTION_SPECIFICATION.md` |
| Taxonomy (TWK/TIU/TKP) | `docs/examination/COMPETENCY_TAXONOMY.md` |
| Product requirements | `docs/product/PRD.md` |
| API / error envelope | `docs/backend/API_SPECIFICATION.md` |
| Analytics rules | `docs/backend/ANALYTICS_ENGINE.md` |
| Provider abstraction | `docs/ai/AI_PROVIDER_ARCHITECTURE.md` |
| System shape / data flow | `docs/architecture/SYSTEM_ARCHITECTURE.md`, `DATA_FLOW.md` |
| Decisions | `docs/decisions/*.md` (ADR-001…ADR-010) |
| Audit register | `docs/AUDIT.md` |

A rule lives in **exactly one** canonical doc; other docs point to it. Do not duplicate. If two docs
contradict, the audit register records it — do not silently edit.

## Doing work

1. Follow the phase you are in; do not start the next phase.
2. Check the canonical doc before writing; add a pointer, not a restatement.
3. Any change to a rule/guarantee is recorded in [docs/AUDIT.md](docs/AUDIT.md) with a severity, not
   silently applied.
4. Edit files in place (this repository is configured to work in the working directory).
5. Commit every completed change as defined in [Git workflow](#git-workflow). No other git operation
   (branch surgery, merge, rebase, force-push) unless the user explicitly requests it.

## File discovery: Graphify first (mandatory)

Any task that searches, traces, or must understand where files live and how they relate starts with
Graphify.

1. Query Graphify before any other search method.
2. Do not lead with `find`, `grep`, `rg`, or directory traversal. Use them only after a Graphify
   query, or for a single known-path lookup.
3. Use Graphify to map inter-file relationships and locate the relevant entry points.
4. If Graphify is unavailable, fails, or cannot find the target, report that limitation before
   falling back to another method.
5. Never claim Graphify was used when it was not.

## Git workflow

### One logical change per commit (mandatory)

Every completed change gets its own commit, immediately.

- One feature, fix, or logical change = one commit.
- The message must be specific and state the change.
- Never bundle unrelated work into one large commit.
- Do not postpone commits until many changes pile up.
- Never create an empty commit.
- Check `git status` and the staged diff before every commit.
- Stage only the files that belong to that change.

Format, subject only:

```
type: concise description
```

Examples: `docs: add scoring methodology`, `fix: correct question validation`,
`feat: implement dashboard layout`, `chore: configure local development`.

### Author and committer identity (absolute)

The only identity allowed as author or committer is `Sakbanullah <okta45168@gmail.com>`.

- Set author and committer for every commit to that identity.
- Verify author and committer before and after every commit.
- Do not change the global Git identity. Use repository-local config or a per-commit mechanism.
- Never record an AI as author, committer, contributor, co-author, reviewer, or Git contributor.
- Never add `Co-authored-by`.
- Never add `Signed-off-by` or any AI identity trailer.
- Never add a commit body. A commit carries a short subject only.
- Never put a model name, AI agent name, Claude, OpenAI, ChatGPT, bot, or AI tool in commit metadata.
- Never make a change that records an AI as a GitHub contributor.

### GitHub contributor policy

The published repository carries exactly one contributor: `Sakbanullah`.

- Audit every commit that will be published before pushing.
- Do not push if any author or committer is not `Sakbanullah <okta45168@gmail.com>`.
- The GitHub account bound to the remote stays the single contributor identity.

## Contribution checklist

- [ ] I have a documented basis for any regulatory/scoring claim I added.
- [ ] I pointed to the canonical doc instead of duplicating a rule.
- [ ] I updated [docs/AUDIT.md](docs/AUDIT.md) for any finding I opened or resolved.
- [ ] I did not start implementation (frontend/backend) without approval.
- [ ] I did not touch AI provider/model/configuration decisions.
- [ ] I used Graphify for file discovery, or I reported why it could not be used.
- [ ] This change is its own commit, checked with `git status` and the staged diff.
- [ ] Author and committer are `Sakbanullah <okta45168@gmail.com>`, verified before and after the commit.