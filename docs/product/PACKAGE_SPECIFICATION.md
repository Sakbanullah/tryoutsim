# Package Specification

Canonical source for **packages**: the unit a learner starts a tryout or a latihan from, and the rules
that decide which questions a session contains. Referenced by
[PRD.md](./PRD.md) §9.2–§9.3, §9.11, [MVP_SCOPE.md](./MVP_SCOPE.md),
[FRONTEND_PAGE_SPECIFICATIONS.md](../frontend/FRONTEND_PAGE_SPECIFICATIONS.md),
[FRONTEND_EXAM_FLOW.md](../frontend/FRONTEND_EXAM_FLOW.md), [API_ENDPOINTS.md](../backend/API_ENDPOINTS.md) §5.

Exam rules, thresholds and config states: [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md).
Question eligibility: [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §7.
Snapshot rules: [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7.
Competency ids: [COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md).

---

## 1. What a package is

A **package** is a named, versioned definition of "what a session contains": a mode, a question target
(one subtest or a submateri set), a difficulty mix, a length, and the selection rules used to build the
roster. A package is **not** a rule set — the exam config stays separate (§3).

| Concept | Meaning | Owner |
|---|---|---|
| Package (template) | named definition with versions | this file |
| Package version | immutable snapshot of the definition at a point in time | this file §5 |
| Roster | the concrete question ids a session froze | [SCORING_METHODOLOGY](../examination/SCORING_METHODOLOGY.md) §7 |
| Package binding | the package id + version copied into a session snapshot | this file §5 |
| Config | counts, weights, thresholds, notice | [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4 |

```ts
type PackageMode = 'tryout' | 'latihan';

type PackageSource = 'builtin' | 'dynamic' | 'custom';

type PackageDefinition = {
  kind: 'full_simulation' | 'subtest' | 'submateri';
  test?: 'TWK' | 'TIU' | 'TKP';        // required for subtest / submateri
  competencyIds?: string[];            // leaves, required for submateri
  itemCount: number;                   // target length
  difficultyMix: Partial<Record<'easy' | 'medium' | 'hard', number>>;  // shares, sum = itemCount
  repeatPolicy: 'avoid_answered' | 'allow_repeat';                   // §4
};

type PackageVersion = {
  packageId: string;
  version: number;                     // monotonic per package
  mode: PackageMode;
  source: PackageSource;
  title: { id: string };               // Indonesian label shown in the UI
  definition: PackageDefinition;
  createdAt: string;
};
```

## 2. Tryout packages

Tryout packages are **simulations**: one session, no feedback during the session, explanations only
after the session ends ([PRD.md](./PRD.md) FR-T6).

| Built-in package | Kind | Contents | Length |
|---|---|---|---|
| **Tryout — Simulasi SKD Lengkap** | `full_simulation` | TWK + TIU + TKP, in that order | config `itemCount` |
| **Tryout — TWK** | `subtest` | TWK only | config `twkCount` |
| **Tryout — TIU** | `subtest` | TIU only | config `tiuCount` |
| **Tryout — TKP** | `subtest` | TKP only | config `tkpCount` |

- A per-subtest tryout uses the same scoring rules as the full simulation for that subtest; it carries
  **no threshold verdict** unless the config's `ThresholdSet` supports a per-subtest-only evaluation
  ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §5.1, §5.4). A full simulation is the
  only package that can produce a `per_subtest_and_total` verdict.
- Counts come from the config. A config with `itemCount = 0` (unknown) cannot back a full simulation;
  the package is then listed as unavailable with the reason
  ([CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.4).

## 3. Config binding

- **A package does not carry a config by default.** The server resolves and binds a CPNS config to a new
  session at creation time, inside package management / session creation — never as a learner step.
  Canonical resolution order: [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §4.2.1.
- **A package cannot require a verified config.** Packages start on whatever the resolution order yields.
  When no `official_verified` config exists, the session runs on a `provisional` config labelled
  **Belum Terverifikasi**; the score is computed on it and **no threshold verdict** is rendered.
- A custom package **may** pin a config (`configId` + `configVersion`) as a management-side reference,
  edited in **Kelola → Manajemen Paket**. The pin is invisible to the learner. If the pin stops being
  usable, resolution falls through to the latest usable config and the package detail states why.
  The pin is the stored nullable column pair `package_version.examConfigId`/`examConfigVersion`
  (AUD-87, PO 2026-11-10): no pin yields `"resolved"`, a used pin `"pinned"`, an unusable pin
  `"fallback"` in the session-creation response's `configResolution` field.
- The learner never selects a config. Config choice, editing and approval live in **Kelola →
  Konfigurasi Ujian** ([FRONTEND_INFORMATION_ARCHITECTURE.md](../frontend/FRONTEND_INFORMATION_ARCHITECTURE.md) §4).
- A session freezes the config it was bound to, including its state (`official_verified` /
  `provisional`) and any unverified-field warnings; a later config version never reaches a started
  session ([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §7).
- No config parameter is fabricated to make a package startable. If counts or scoring rules are unknown
  in every candidate config, the package reports **unavailable with the reason**, not a guessed rule set.

## 4. Question selection rules

Selection runs **once**, at session creation, against the live bank, and produces the roster that is then
frozen.

### 4.1 Eligibility

A question is selectable only when **all** hold:

1. `lifecycle = 'active'` ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §3);
2. `test` and `competencyId` match the package definition;
3. `eligibleForDynamicPackage = true` — set for a question whose batch passed automated validation and
   whose sampling requirement is satisfied (§6), or for a manual question that passed technical
   validation;
4. not `withdrawn` (a withdrawn question is `quarantined`, so rule 1 already excludes it).

`active` is necessary but **not sufficient**: a question that `SELECT`ed itself through individual
review but belongs to a batch whose sampling is still pending is `active`
(`lifecycle`) with `dynamicEligible = false`.

### 4.2 Ordering and the repeat rule

1. Filter to eligible questions.
2. Partition by **answered history**: a question the user has already answered in a session
   (any mode, any time) is *seen*; every other question is *unseen*.
3. `repeatPolicy: 'avoid_answered'` (tryout, and the default for latihan): take unseen first; take seen
   items only to fill a shortfall, in the order of **least recently answered** first.
4. `repeatPolicy: 'allow_repeat'` (latihan reinforcement packages): both pools are considered, still
   least-recently-answered first, because repetition is the intent.
5. Within a pool, order by difficulty mix, then by `difficulty.empirical` when reportable, else
   `difficulty.aiInitial`, then by `createdAt` (oldest first) for determinism.

### 4.3 Shortfall and the repeat warning

- If unseen stock cannot fill `itemCount` under `avoid_answered`, the package **may** still be started,
  and the start screen states before the session begins: how many items are repeats, and for them, how
  many times each has been answered. That number is a **server-computed field** on the package view
  (`repeatWarning`), never a client-side guess.
- The session snapshot records the number of repeated items (`snapshot.roster.repeatCount`) so a result
  can say honestly whether it was measured on fresh material.
- If eligible stock is **zero**, the package is unavailable with the reason and a link to the bank; it
  never starts an empty session (`PF-00` would reject it).
- Latihan may repeat **without** a warning blocking the start: the warning is shown as information, and
  only the count is stated ([PRD.md](./PRD.md) FR-P1–FR-P3).

### 4.4 Determinism boundary

Selection is **not** part of scoring and is not required to be deterministic across two calls; it is
required to be deterministic **once frozen**. The same snapshot always scores identically
([SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md) §1).

## 5. Custom packages and versioning

- A **custom package** is created from one of the built-in templates (§2), edited, and saved. Allowed edits:
  `itemCount`, `difficultyMix`, `competencyIds` (latihan only), `repeatPolicy`, `title`.
  Forbidden edits: `mode`, `kind`, `test` (a saved package keeps its target; create a new one instead).
- **Every save creates a new version.** A package version is immutable; `PUT` is not offered
  ([API_ENDPOINTS.md](../backend/API_ENDPOINTS.md) §5). Deleting a package retires it (`retiredAt`) and
  never removes its versions, because a session may reference one.
- **A started session is pinned to the version it was created with.** The snapshot carries
  `packageBinding = { packageId, packageVersion, rosterHash }`. A later version never alters a started
  or finished session.
- A retired package version stays readable for the sessions that reference it and is not selectable for
  new sessions.

## 6. Latihan packages

| Kind | Who defines it | Example |
|---|---|---|
| Curated built-in `submateri` package | shipped data | "Latihan — Analogi" over `TIU.VERBAL.ANALOGI` |
| Curated built-in `subtest` package | shipped data | "Latihan — TIU campuran" |
| Weakness drill | generated by [RECOMMENDATION_ENGINE](../ai/RECOMMENDATION_ENGINE.md) §5 | leaves of the ranked weaknesses |
| Custom submateri package | the user (§5) | "Deret angka, 15 soal mudah" |

- Latihan gives feedback after **each answer**: correctness for TWK/TIU, attained points and the weight
  of **every** option for TKP, plus the explanation
  ([FRONTEND_EXAM_FLOW.md](../frontend/FRONTEND_EXAM_FLOW.md) §9).
- The submateri list is exactly the taxonomy's leaf nodes
  ([COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md) §2). IDs are never shown; labels are.

## 7. Sampling gate and dynamic eligibility

- A question enters the dynamic pool only when its batch passed automated validation **and** the user's
  sampling requirement for that batch is satisfied
  ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6).
- Sampling is a **quality signal, not a guarantee**: the app states that a batch was sampled and how
  much, and keeps the report/withdrawal path open after publication (§6 of the question spec).
- A withdrawn question leaves the pool at the next selection. It never leaves a frozen roster.

## 8. What this file does not own

- Scoring, thresholds, snapshot internals → [SCORING_METHODOLOGY.md](../examination/SCORING_METHODOLOGY.md).
- Question lifecycle and validation → [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md).
- Screens and copy → [FRONTEND_PAGE_SPECIFICATIONS.md](../frontend/FRONTEND_PAGE_SPECIFICATIONS.md).
