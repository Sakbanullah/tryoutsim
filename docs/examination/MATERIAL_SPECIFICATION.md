# Material Specification

Canonical source for **learning material (Materi)**: the record, its origins, versions, approval and
evidence rules. Referenced by [PRD.md](../product/PRD.md) §9.8, [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md) §4,
[DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md), [API_ENDPOINTS.md](../backend/API_ENDPOINTS.md) §7,
[FRONTEND_PAGE_SPECIFICATIONS.md](../frontend/FRONTEND_PAGE_SPECIFICATIONS.md) §7.

Competency ids: [COMPETENCY_TAXONOMY.md](../examination/COMPETENCY_TAXONOMY.md).
Evidence tiers: [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §0.

> **Replaces the earlier MVP decision DB-1 ("no material bank").** Materials are in MVP; the change and
> its consequences are recorded in [../AUDIT.md](../AUDIT.md) and
> [../audit/SYSTEM_REVISION_REPORT.md](../audit/SYSTEM_REVISION_REPORT.md) §7.

---

## 1. Record

```ts
type Material = {
  id: string;
  title: string;
  contentType: 'conceptual' | 'strategy' | 'factual' | 'legal' | 'historical' | 'policy';
  scope: MaterialScope;                 // §2
  body: string;                         // Indonesian text, markdown subset
  status: 'draft' | 'approved' | 'retired';
  provenance: MaterialProvenance;       // §3
  sources: SourceRef[];                 // §4 — required for some contentTypes
  version: number;                      // bumps on any edit
  approval?: MaterialApproval;          // §5
  createdAt: string;
  updatedAt: string;
};
```

A material is selectable for recommendation only when `status = 'approved'` **and** its `version` has a
matching `approval.version`.

## 2. Scope — taxonomy-bound or free

```ts
type MaterialScope =
  | { kind: 'competency'; competencyId: string }   // exact leaf id (§2.1)
  | { kind: 'domain'; competencyId: string }       // domain node id
  | { kind: 'free'; note: string };                // the user's own note, outside the taxonomy
```

1. **Main material follows the taxonomy.** A competency or domain material refers to a real, non-deprecated
   taxonomy node; labels shown to the user come from the taxonomy, never from free text.
2. **Free notes are allowed.** A `free` material is the user's own note. It is listed in Materi and can be
   read at any time; it is **not** offered as a recommendation target.
3. **Unmapped material must not affect competency analytics.** A `free` material contributes nothing to
   `perCompetency`, coverage, weaknesses or ranking, and no analytics field is derived from it. Only a
   `competency`/`domain` material may be matched to a weakness
   ([RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md) §4).

## 3. Provenance

| `kind` | Meaning | Required fields |
|---|---|---|
| `manual` | written by the user | `authoredAt` |
| `ai_drafted` | produced by a provider, not yet reviewed | `providerId`, `modelId`, `promptTemplateId`, `promptVersion`, `generatedAt` |
| `ai_drafted_reviewed` | AI draft edited/accepted by the user | above, plus `reviewedAt` |

Rule inherited from the question model: AI-drafted material is a **draft until the user approves it**;
nothing AI-made is `approved` on arrival ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §2.1
"never official", applied to material).

## 4. Sources — by content type

| `contentType` | Needs verifiable sources? | What counts |
|---|---|---|
| `conceptual` (definitions, reasoning technique) | **no** | — |
| `strategy` (how to approach a question type, time management) | **no** | — |
| `factual` (history, institutions, language rules) | **yes** | a citable document or a tiered entry in [CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §2–§3 |
| `legal` (statutes, regulations) | **yes** | instrument number + article, with a fetched source |
| `historical` (prior-cycle rules) | **yes** | the prior-cycle instrument, tier `HISTORICAL` |
| `policy` (recruitment policy, formation rules) | **yes** | the issuing document |

```ts
type SourceRef = {
  document: string;         // e.g. "Peraturan Menteri PANRB"
  number: string;           // e.g. "6/2024"
  article?: string;
  url?: string;
  fetchedAt?: string;
  tier: 'VERIFIED-2026' | 'VERIFIED-CURRENT' | 'HISTORICAL' | 'UNVERIFIED';
};
```

**Unverified sources are labelled, never promoted.** A `SourceRef` whose `tier` is `UNVERIFIED`, or a
sourced material whose source has no URL, renders with the label **Sumber belum terverifikasi** and is
never presented as official fact. A material with a missing required source cannot reach `approved`
(validation M-01…M-04, §6).

## 5. Approval and versioning

- A material reaches `approved` only by an explicit user act on a **specific version**
  (`MaterialApproval { version, approvedByUserAt, approvedBy }`).
- Any edit bumps `version` and returns the material to `draft`; the previous version stays readable in
  history and any recommendation that referenced it shows the version it was approved at.
- `retired` materials leave the recommendation pool and are never deleted while a recommendation record
  references them.

## 6. Validation

| ID | Check | Blocks `approved` |
|---|---|---|
| M-01 | `title` and `body` non-empty | yes |
| M-02 | `scope.kind = 'competency'`/`'domain'` → the node exists and is non-deprecated | yes |
| M-03 | `contentType` in the factual/legal/historical/policy group → at least one `SourceRef` | yes |
| M-04 | every `SourceRef` has `document` and `number`; `tier` present | yes |
| M-05 | no prohibited official-claim string ("materi resmi", "materi BKN", official logo reference) when provenance is AI | yes |
| M-06 | `body` mentions the keyed competency label (heuristic, flags only) | no |

A material's validation is tied to its `version`; editing invalidates it.

## 7. Boundaries

- Weakness ranking and which material is offered → [RECOMMENDATION_ENGINE.md](../ai/RECOMMENDATION_ENGINE.md).
- Prompt that drafts material → [PROMPT_SPECIFICATION.md](../ai/PROMPT_SPECIFICATION.md).
- Storage → [DATABASE_SCHEMA.md](../backend/DATABASE_SCHEMA.md) `material` / `material_version`.
