# Frontend Mock Data Strategy

How the frontend runs without a backend, frontend-first (ADR-006). The mock must be indistinguishable
from the backend **at the contract level** ([FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md)),
not in content.

---

## 1. Goal

- Every documented endpoint is mockable with its exact success and error envelopes
  ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §2–4).
- The mock **never scores**. It returns canned `ScoreResult`s that are internally consistent, so the
  UI renders real claims while computing nothing.
- The mock is **one seam**: one module behind the Data client. No component branches on "is mock"
  ([FRONTEND_STATE_MANAGEMENT](./FRONTEND_STATE_MANAGEMENT.md) §3).

## 2. Mandatory labels

Every mock payload carries `MOCK DATA — NOT FROM API` — once in the Data client's dev log line, and
once in any screen where a value could otherwise be believed (result summary, analytics card). The
label is removed in the same commit that switches the client to `/api/v1`.

## 3. Fixture rules

| Rule | Detail |
|---|---|
| **No invented regulation** | Fixture thresholds are either `mode: 'none'` or use the shipped defaults from [CPNS_2026_REGULATIONS](../examination/CPNS_2026_REGULATIONS.md) §4.4. A fixture never invents a NAB, a duration or a question count and presents it as a rule. |
| **Config fixtures** | One per shipped config: `skd-cpns-2024` (`historical`), `skd-cpns-2026-provisional` (`provisional`, `mode: 'none'`, labelled **Belum Terverifikasi**). The two CPNS fixtures exercise every badge that may appear in Kelola, plus the no-verdict result path. A `legacy` row exists only to prove `GET /exam-configs` does not return it. |
| **TKP** | Options carry no "correct" affordance; `correct: null`; attainment shown. A TKP `ReviewQuestion` fixture carries `optionJustifications` keyed exactly like `optionScores`, one per option, including a **tie** so two options share the maximum weight and each still has its own reason. |
| **Unanswered** | At least one TWK/TIU item with `selected: null` so the `—` rule is exercised. |
| **Tinjau jawaban (E78)** | Six review fixtures, plugged into the same `ScoreResult` they belong to: (a) TIU answered **wrong**, version matches — explanation rendered, key rendered; (b) TWK **right**, version matches; (c) unanswered, version matches; (d) TKP with justifications and a tie; (e) TKP **without** `optionJustifications` (`justificationsSource: 'none'`) so the missing-reasoning sentence renders; (f) `latestContentVersion` ≠ `frozenContentVersion` so the block renders "Pembahasan untuk soal ini belum tersedia." **and no explanation**, not the newer text. A Latihan link appears in (f) only when the fixture also carries a resolvable material relation; one fixture lacks it so the no-link path is exercised. `earned`/`maxScore`/`selected`/`correct` in every fixture **equal** the matching `byQuestion` row. |
| **Analytics states** | One cell per `state`: `reportable`, `insufficient_data`, `zero_correct`, `zero_attainment`. |
| **Mixed versions** | One snapshot with `comparability.mixed: true` and two `versions[]` entries. |
| **Package fixtures** | One per built-in package: *Simulasi SKD Lengkap*, *TWK*, *TIU*, *TKP*, plus one Latihan submateri package. Each covers `startable: true`, a short-stock repeat warning, and zero stock. |
| **Clock fixtures** | One session with `durationMs` set and one with `null`; both carry `activeMs`, and one has `runningSince: null` to exercise the paused indicator. |
| **Notification fixtures** | One per event group of [NOTIFICATION_SPECIFICATION](../backend/NOTIFICATION_SPECIFICATION.md) §2, one unread, one with a deep link. |
| **Errors** | Toggle fixtures for `PREFLIGHT_FAILED` (with `errors[]`), `CONTRACT_MISMATCH`, `PROVIDER_AUTH_FAILED`, `RATE_LIMITED`. A missing approval is **not** an error fixture — it is a `ScoreResult` with `verdict: null`. Each is switched on by an explicit dev toggle — never randomly. |
| **GAP types** | Every type listed in [FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md) §6 gets a **provisional fixture** whose shape matches the documented subset, marked `GAP-<id>` in a dev-only note; it must not be presented as the real shape in any acceptance review. |

## 4. What the mock may NOT do

- **Impersonate an authority.** No fixture stem or explanation claims to be an official CPNS/BKN item.
- **Imply an endpoint exists.** A fixture named after a route that is not in
  [API_ENDPOINTS](../backend/API_ENDPOINTS.md) is forbidden; gaps stay gaps.
- **Show a config in Belajar.** No fixture drives a config badge, selector or notice onto Beranda, the
  package picker, the runner or Progres.
- **Invent a score.** `ScoreResult` fixtures are hand-written consistent numbers — `earned ≤ possible`,
  `correctCount ≤ answeredCount`, TKP `correctCount = 0`, `byQuestion` one row per roster item. The
  mock does not run a formula.
- **Compute `keyedOption` or a status.** E78 fixtures state the keyed option and the status inputs
  directly; the mock never derives the key from `optionScores` — that would put a scoring rule in the
  frontend seam ([API_SPECIFICATION](../backend/API_SPECIFICATION.md) §7.7).

## 5. Hand-off

When the backend is approved (Gate 3), the mock module is deleted and the Data client points at
`/api/v1`. Because all types live in [FRONTEND_DATA_CONTRACTS](./FRONTEND_DATA_CONTRACTS.md), no
component changes are required. GAP types are re-typed from the backend response *after* the contract
is documented, not guessed from the mock.
