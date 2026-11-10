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
2. **Pathway separation, and CPNS-only scope.** The product serves CPNS only. Rules from any other
   recruitment pathway are never cited as CPNS 2026 authority, and no screen, package, report or prompt
   offers another pathway. A retained non-CPNS config is evidence-only (`dataProvenance: 'legacy'`) and
   is never returned by a selectable route.
3. **No silent approval drift, no blocked session.** A `provisional` config **is** startable and
   scorable; a threshold **verdict** requires a valid approval. Any change to the four bound values
   (`configVersion`, `scoringVersion`, `regulatoryBasisHash`, `configId`) invalidates the approval and
   withholds the verdict only. See [docs/examination/SCORING_METHODOLOGY.md](docs/examination/SCORING_METHODOLOGY.md) §5.6, §11.
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
| Questions/lifecycle/validation/sampling | `docs/examination/QUESTION_SPECIFICATION.md` |
| Materials | `docs/examination/MATERIAL_SPECIFICATION.md` |
| Packages / session assembly | `docs/product/PACKAGE_SPECIFICATION.md` |
| Notifications | `docs/backend/NOTIFICATION_SPECIFICATION.md` |
| Deployment / backup / restore | `docs/architecture/DEPLOYMENT_AND_BACKUP.md` |
| Navigation / screens | `docs/frontend/FRONTEND_INFORMATION_ARCHITECTURE.md` |
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

## Subagent delegation (proactive)

The main agent decides on its own whether a task needs a subagent, which agent is the best fit,
whether several run in parallel, and whether the result needs an independent review. The user does
not name agents per task. Delegate only when it buys isolation or domain specialization.

Available project agents — use these names; do not create duplicates:

| Agent | Use for |
|---|---|
| `frontend-developer` | Frontend implementation: React/TypeScript/Vite/Tailwind pages, components, forms, state and mock-API integration in `frontend/` |
| `ui-reviewer` | Read-only UI/UX audit: hierarchy, typography, spacing, colour, layout, navigation, forms, tables, dialogs, keyboard/accessibility, Light/Dark |
| `api-reviewer` | Read-only API contract audit: paths, methods, parameters, payloads, response types, missing endpoints, fabricated mocks |
| `backend-developer` | Backend implementation in `backend/` after the frontend gate: endpoints, DTOs, rules, PostgreSQL persistence, background jobs, error handling |
| `database-reviewer` | Read-only data-integrity audit: schema, relationships, migrations, indexes, constraints, transaction boundaries, immutability, backup/restore |
| `code-reviewer` | Read-only independent code review: correctness, edge cases, security, duplication, architecture, error handling, convention drift |

### When to delegate

1. Small task, simple question, or one-line change: do it directly, no subagent.
2. Frontend implementation: consider `frontend-developer`.
3. UI/UX audit: use `ui-reviewer`.
4. Backend implementation: consider `backend-developer`.
5. API contract audit: use `api-reviewer`.
6. Database schema or migration audit: use `database-reviewer`.
7. Code quality or security review: use `code-reviewer`.
8. Full-stack task: split by domain and delegate only genuinely independent work.
9. Complex implementation: consider an independent review after implementation is complete.

### Mandatory safeguards

- The main agent remains responsible for all work.
- Never run a reviewer while changes are being made to the files it is auditing.
- Never give two potentially file-overlapping edit tasks to different agents.
- Never run every agent just because it is available.
- Never delegate a task that needs no isolation or specialization.
- Respect each agent's permitted tools and limits.
- Honor Gate 3 for `backend-developer`.
- Perform no Git operations without approval.
- Never change Product Owner decisions or canonical documentation.
- Never fabricate delegation results; if an agent cannot be invoked, report it explicitly.

### Execution and transparency

Before delegating: identify the scope, name the chosen agent and the reason, and confirm there is no
file conflict. After delegating: evaluate each agent's result, verify its changes and findings, and
merge them into the main report. A delegated result is input, not a final answer — verify it before
reporting.

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

## Code Quality and Maintainability Standards

All code must be written clearly, consistently, and with long-term maintainability in mind.

### 1. Clarity and Readability
- Write code that is easy to read, understand, and maintain.
- Use descriptive and consistent names for variables, functions, classes, types, and files.
- Keep functions focused on a single responsibility.
- Prefer straightforward control flow over clever, overly abstract, or unnecessarily complex implementations.
- Follow the established project conventions and formatting rules.

### 2. Function Documentation
- Every function must have a concise comment or documentation explaining its purpose.
- Describe what the function does and, when not obvious, why it exists.
- Document important parameters, return values, side effects, and exceptional behavior when relevant.
- Use the documentation convention appropriate to the language (e.g. JSDoc for TypeScript/JavaScript).
- Comments must explain intent or non-obvious behavior, not merely repeat the function name or translate the implementation into prose.
- Do not add redundant comments to every line of code.

### 3. Simplicity and Minimal Implementation
- Implement the simplest solution that correctly satisfies the requirements.
- Do not write code that is unnecessary, unused, speculative, or unrelated to the current task.
- Avoid premature abstraction, unnecessary design patterns, excessive indirection, and over-engineering.
- Do not introduce dependencies when the existing stack can solve the problem cleanly.
- Avoid creating wrappers, helpers, classes, interfaces, or configuration options without a concrete need.
- Do not sacrifice correctness, security, or readability merely to reduce the number of lines.

### 4. Zero Unnecessary Code Duplication
- Do not duplicate business logic, validation rules, transformations, or reusable behavior across the codebase.
- Before implementing new functionality, inspect existing code and reuse an appropriate implementation when possible.
- Extract shared logic into a reusable function or module when it is genuinely used in multiple places.
- Maintain a single source of truth for shared constants, configuration, types, and business rules.
- Do not create abstractions for code that is only used once unless there is a clear architectural reason.
- Avoid both copy-paste duplication and excessive abstraction.

### 5. Function and File Boundaries
- Keep functions small and cohesive, but do not split code into trivial functions without a meaningful benefit.
- Separate responsibilities when doing so improves clarity and maintainability.
- Keep related functionality close together.
- Avoid oversized files containing unrelated responsibilities.
- Prefer explicit dependencies and data flow over hidden global state or implicit side effects.

### 6. Type Safety and Error Handling
- Use the project's type system properly.
- Avoid `any`, unsafe type assertions, and suppression directives unless strictly necessary and documented.
- Validate external input at system boundaries.
- Handle errors explicitly and preserve useful error context.
- Never silently swallow errors or introduce arbitrary fallback values that hide failures.

### 7. Changes to Existing Code
- Inspect the existing implementation and its dependencies before modifying it.
- Make focused changes; do not rewrite unrelated code.
- Reuse established project patterns unless they are demonstrably flawed.
- Remove obsolete code only when it is made unnecessary by the current change.
- Update affected documentation and dependent contracts when behavior or interfaces change.

### 8. Completion Checklist
Before considering a code change complete, verify:

- [ ] Every function has a meaningful purpose comment or documentation.
- [ ] Names and control flow are clear.
- [ ] No unnecessary or unused code was introduced.
- [ ] No unnecessary duplicated logic exists.
- [ ] No premature abstraction or over-engineering was introduced.
- [ ] Types, validation, and error handling are appropriate.
- [ ] Existing project conventions are followed.
- [ ] The change does not introduce unrelated modifications.

## Frontend UI/UX: UI UX Pro Max is mandatory

Applies to any work that changes how the frontend looks, feels, moves, or is interacted with: pages,
layouts, components, navigation, forms, tables, dialogs, colour, typography, spacing, motion, loading,
empty, error and success states. Does not apply to non-visual work.

1. **Discover, do not assume.** Before starting, find the installed **UI UX Pro Max** skill and read its
   `SKILL.md` and the references it names (`references/quick-reference.md`, `references/pro-rules.md`).
   Discover its path and commands from the environment; never guess them.
2. **If it is unavailable, stop and report it.** Say so explicitly. Do not claim to have used it.
3. **Apply it throughout implementation**, not only during planning: consult the relevant rule domain
   while building each screen, and run the skill's pre-delivery checklist before reporting the work done.
4. **Evaluate, do not copy.** The skill's searches return generic recommendations (palettes, fonts,
   styles). Judge each against TryoutSim's product requirements and its desktop-first exam use: the
   target is a coherent, professionally designed desktop web application, not a stock dashboard template.
   Reject any recommendation that conflicts with the constraints above, the canonical docs in the table
   above, or `docs/frontend/DESIGN_SYSTEM.md`; keep the existing design tokens unless a decision recorded
   there changes them.
5. **Rendering only.** The design work never re-derives scores, verdicts, metrics or percentages; the
   frontend renders backend-contract data (constraint 5).

## Ambiguity Handling & Clarification Protocol

### 1. Core Principle

**Never guess the user's intent when an instruction is ambiguous, unclear, incomplete, or reasonably open to multiple interpretations. Ask for clarification instead.**

Correctness and alignment with the user's actual intent take priority over execution speed.

An incorrect implementation based on an unverified assumption is worse than pausing to ask one clarification question.

### 2. Mandatory Clarification Rules

You MUST stop and request clarification when:

1. A user instruction has two or more materially different interpretations.
2. The requested scope, expected outcome, or target component is unclear.
3. A requirement could refer to different behaviors, screens, endpoints, entities, or workflows.
4. A request appears to contradict an existing Product Owner decision or canonical specification.
5. A technical decision requires product-level, architectural, or business-rule authority that has not been granted.
6. Required information is missing and cannot be safely derived from authoritative project documentation.
7. It is unclear whether the user authorizes documentation changes, source-code changes, configuration changes, or destructive operations.
8. An instruction could cause unintended changes outside the explicitly requested scope.

Do not proceed with affected work until the ambiguity is resolved.

### 3. Never Convert Assumptions into Requirements

You MUST NOT:

- Invent missing requirements, acceptance criteria, business rules, or expected behaviors.
- Treat personal interpretation as an approved Product Owner decision.
- Assume that a short instruction authorizes broader implementation.
- Extend the requested scope for convenience.
- Silently choose between conflicting specifications.
- Replace an unclear requirement with a supposedly reasonable alternative.
- Present an assumption as an established project fact.
- Claim that an implementation satisfies the user's intent when that intent has not been established.

Context and previous conversations may help identify the ambiguity, but they do not automatically authorize an unconfirmed decision.

### 4. Clarification Response Format

When clarification is necessary, respond concisely using this structure:

**What I understand:** State the current interpretation of the request.

**What is unclear:** Identify the exact ambiguity.

**Possible interpretations:** Present materially different interpretations when useful.

**Question:** Ask the minimum number of specific questions needed to proceed.

Avoid overwhelming the user with unnecessary questions. Prefer one focused question at a time.

### 5. Safe Autonomous Decisions

You MAY make implementation-level decisions without asking when ALL of these conditions are satisfied:

- The user's objective and expected behavior are clear.
- The decision falls within your assigned responsibilities.
- The decision does not alter approved product behavior or business rules.
- The decision does not contradict canonical documentation or existing decisions.
- The implementation is reversible and within the authorized scope.
- No additional Product Owner approval is required by project policy.

For ordinary implementation details, use established project conventions and document relevant decisions where appropriate.

Do not ask the user to approve every minor technical detail.

### 6. Agent Team and Subagent Responsibilities

This protocol applies to ALL agents:

- Main session.
- Team Lead.
- Builders.
- Testers.
- Reviewers.
- General-purpose subagents.
- Any subsequently created project agents.

When a subagent encounters ambiguity:

1. Stop the affected task.
2. Do not independently invent or approve a resolution.
3. Report the ambiguity and relevant evidence to the Team Lead.
4. The Team Lead determines whether existing authoritative documentation resolves it.
5. If Product Owner clarification is required, escalate the question to the Product Owner.
6. Resume the affected task only after the ambiguity has been resolved.

Unrelated tasks may continue if they are genuinely independent and do not rely on the unresolved decision.

Never propagate an unverified assumption as an instruction to another agent.

### 7. Conflicting Documentation

When documentation conflicts:

1. Identify the conflicting sources.
2. Determine their authority using the project's established documentation hierarchy.
3. Do not silently overwrite one decision with another.
4. Report the conflict with exact file paths and relevant sections.
5. Request Product Owner clarification when the hierarchy does not resolve the conflict or a new product decision is required.

Historical documents must not be treated as current requirements without verification.

### 8. Scope and Authorization Protection

An instruction authorizing one task does not automatically authorize adjacent tasks.

Examples:

- Permission to update documentation does not authorize source-code changes.
- Permission to implement one endpoint does not authorize unrelated endpoint changes.
- Permission to review code does not authorize modifying it.
- Permission to investigate a migration does not authorize executing it.
- Permission to prepare an implementation plan does not authorize starting implementation.
- Permission to run subagents does not authorize creating additional agents beyond the specified scope.

Respect all explicit approval boundaries and project roadmap gates.

### 9. Reporting Uncertainty

When an assumption is unavoidable for analysis but does not authorize implementation:

- Clearly label it as an assumption.
- Explain why it is necessary for the analysis.
- Identify its impact.
- Do not implement or finalize decisions that depend on it without authorization.

If no safe assumption exists, stop and ask.

### 10. Final Rule

**Ask rather than guess. Verify rather than assume. Escalate rather than silently decide.**

Do not sacrifice requirement correctness for speed or apparent autonomy.

### Delegation and Subagent Usage

Before starting a task, assess its expected duration, complexity, dependencies, and workload.

- If a task is likely to take significant time, involves multiple independent workstreams, or requires substantial investigation and implementation, delegate suitable work to subagents instead of relying entirely on the main agent.
- Break the task into clearly scoped, independent assignments with explicit responsibilities, file ownership, and acceptance criteria.
- Run independent assignments in parallel when practical. Respect dependencies and execution order when tasks rely on one another.
- The main agent remains responsible for planning, coordination, integration, resolving conflicts, and verifying the combined result.
- Review subagent outputs critically. Do not assume delegated work is correct or complete without verification.
- Handle failed, incomplete, or conflicting subagent results before considering the overall task complete.
- Do not delegate tasks that are too small or tightly coupled to justify the overhead.
- Reuse existing project agents and their defined responsibilities. Do not create duplicate roles unnecessarily.
- Never claim native Agent Team functionality when only ordinary subagents are available. Report the actual delegation mechanism used.
- If subagents are unavailable, explain the limitation and proceed with the best practical alternative.

**Default principle:** Do not make the main agent handle a large, time-consuming task alone when meaningful parallel delegation is possible.