# Risk Register

Canonical list of risks that shape planning decisions. References the audit register
[../AUDIT.md](../AUDIT.md) and the uncertainty register
[../examination/CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §7 rather than
restating them.

| ID | Risk | Likelihood | Impact | Mitigation | Owner status |
|---|---|---|---|---|---|
| R-1 | **CPNS 2026 regulatory uncertainty** (no CPNS-2026 SKD instrument; NAB/duration/weights UNV-01…05) | High | High | Provisional config + approval integrity; never claim official 2026; re-check at each review | tracked in UNV-01…08 |
| R-2 | **Dataset quality** (AI-generated questions mislabelled/mis-keyed) | High | High | Provenance + lifecycle + V-01…12 + SC-01…08; no AI→active without user accept | resolved-by-design |
| R-3 | **AI-generated question drift** (model invents "official" framing) | Medium | High | Prohibited-strings V-12, visible badge, prompt invariant text | resolved-by-design |
| R-4 | **Scoring correctness** (regex-parsed IDs, NaN buckets, mutable history) | Medium | Critical | Explicit metadata (PF-07), `??=` buckets, session snapshots (PF-10) | resolved (AUD-05..07,21) |
| R-5 | **Analytics misleading** (small-sample over-claim, TKP "accuracy") | Medium | High | Minimum sample, zero-vs-insufficient split, attainment for TKP | resolved-by-design |
| R-6 | **Sekolah Kedinasan rule laundering into CPNS** | Medium | High | Pathway-tagged tier + PF-12 + §8 rule 5 | resolved-by-design |
| R-7 | **Frontend↔backend contract drift** | Medium | Medium | Single contract pair (`API_SPECIFICATION` ↔ `FRONTEND_DATA_CONTRACTS`), catalogued in audit | ongoing |
| R-8 | **Secret leak** (provider key in logs/bundle) | Medium | High | Write-only keys, masked tail, NFR-7, no-leak error handling | resolved-by-design |
| R-9 | **Approval silently invalidated** (config edit mid-session) | Medium | High | 409 `APPROVAL_INVALID {changed[]}`, stored unscored, re-approve path | resolved-by-design |
| R-10 | **Dependency/licence drift** | Low | Medium | Dependency minimalism (ADR-008); no unapproved additions | accepted |

Resolution status column mirrors [AUDIT.md](../AUDIT.md): `resolved-by-design` means a documented
mechanism exists; `ongoing` means a later phase must verify it.