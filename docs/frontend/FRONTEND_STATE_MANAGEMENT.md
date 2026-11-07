# Frontend State Management

State strategy. Constraint: **no premature Zustand/Redux/TanStack Query**
([plan](../architecture/ARCHITECTURE_DECISIONS.md), ADR-010 Proposed). This file fixes the *approach*
and the *upgrade triggers*, not a library choice.

---

## 1. Default: nothing special

- Screen-local UI state lives in the component.
- Server data is fetched through the Data-layer client and held where it is read
  ([FRONTEND_COMPONENT_ARCHITECTURE.md](./FRONTEND_COMPONENT_ARCHITECTURE.md) §5).
- The rule: **state closest to where it is used; promote only when it must be shared.**

## 2. Shared client state (the only global)

A single small module store holds the few things genuinely shared across screens:

| State | Shape | Shared because |
|---|---|---|
| `contractVersion` | string | matched against `meta.version` once per boot |
| `activeRunner` | `{ sessionId, mode } | null` | runner is modal over the shell, survives child remount |
| `currentConfigId` | string \| null | dashboard + tryout + result share it |

That is the whole global surface for MVP. Everything else is local or fetched-read-local.

## 3. Server cache policy (no query library yet)

- Every read is a plain `fetch` via the Data client, returning typed contracts.
- **Stale-while-revalidate by convention**: re-fetch on route enter for read endpoints; the runner's
  in-progress sheet uses `PATCH` autosave and does **not** keep a second cached copy.
- No client-side recomputation of scores/metrics (BR-X2): the client stores what the server returned,
  never a derived score.

## 4. Upgrade triggers (add a library only when a real need appears)

| symptom observed | then |
|---|---|
| Several screens need manual cache invalidation and it becomes bug-prone | introduce a minimal query cache |
| Global state grows beyond the three slots and mutations cross many features | introduce a small store library |
| The Data client can no longer keep fetch/parse logic DRY | refactor the client, not add a framework |

Until one of these is actually observed, the baseline stays ([MVP_SCOPE](../product/MVP_SCOPE.md) §2).

## 5. Error state

`PREFLIGHT_FAILED` / `APPROVAL_INVALID` / `APPROVAL_VERSION_MISMATCH` /
`THRESHOLD_CONFIG_INVALID` are handled **once** in the Data layer's error mapper and exposed to
screens as typed results (e.g. `{ kind: 'blocked', changed: [...] }`), not as scattered `try/catch`
([FRONTEND_DATA_CONTRACTS.md](./FRONTEND_DATA_CONTRACTS.md) §5).