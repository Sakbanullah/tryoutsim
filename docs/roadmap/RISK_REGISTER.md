# Risk Register

Canonical list of risks that shape planning decisions. References the audit register
[../AUDIT.md](../AUDIT.md) and the uncertainty register
[../examination/CPNS_2026_REGULATIONS.md](../examination/CPNS_2026_REGULATIONS.md) §7 rather than
restating them.

| ID | Risk | Likelihood | Impact | Mitigation | Owner status |
|---|---|---|---|---|---|
| R-1 | **CPNS 2026 regulatory uncertainty** (no CPNS-2026 SKD instrument; NAB/duration/weights UNV-01…05) | High | High | Sessions start on a `provisional` config labelled **Belum Terverifikasi**; score always produced, verdict only with a valid approval; never claim official 2026 | tracked in UNV-01…08 |
| R-2 | **Dataset quality** (AI-generated questions mislabelled/mis-keyed) | High | High | Provenance + lifecycle + layers T/Q/K/S + sampling gate + reports/withdrawal | resolved-by-design |
| R-3 | **AI-generated question drift** (model invents "official" framing) | Medium | High | Prohibited-strings V-12, visible badge, prompt invariant text | resolved-by-design |
| R-4 | **Scoring correctness** (mutable history, drifting config) | Medium | Critical | Session snapshot, `packageBinding`, deterministic pure scoring, immutability | resolved (AUD-05..07,21) |
| R-5 | **Analytics misleading** (small-sample over-claim, TKP "accuracy") | Medium | High | Minimum sample, conclusion gate at ≥ 3 comparable sessions, zero-vs-insufficient split, attainment for TKP | resolved-by-design |
| R-6 | **Non-CPNS rule laundering into CPNS** | Medium | High | CPNS-only product scope; `dataProvenance: 'legacy'` rows never returned; pathway never cited as CPNS authority | resolved-by-design |
| R-7 | **Frontend↔backend contract drift** | Medium | Medium | Single contract pair (`API_SPECIFICATION` ↔ `FRONTEND_DATA_CONTRACTS`), catalogued in audit | ongoing |
| R-8 | **Secret leak** (provider key in logs/bundle/backup) | Medium | High | Write-only keys in OS secure storage, masked tail, keys excluded from backups, NFR-7 | resolved-by-design |
| R-9 | **Approval silently invalidated** (config change mid-session) | Medium | Medium | Any version bump withholds the verdict and names the changed value; score and session unaffected | resolved-by-design |
| R-10 | **Dependency/licence drift** | Low | Medium | Dependency minimalism (ADR-008); no unapproved additions | accepted |
| R-11 | **Exam time lost to a closed browser or crash** | Medium | High | Duration is accumulated active time; autosave carries the clock; resume on return | resolved-by-design |
| R-12 | **Generation work lost on restart or browser close** | Medium | High | Jobs run server-side; leftovers inspected at start; safe batches resume, others `interrupted` + explicit retry; partial output kept | resolved-by-design |
| R-13 | **Backup reported as success when it failed** | Low | Critical | Every archive verified before success is recorded; failure raises a `failed` record and a notification | resolved-by-design |
| R-14 | **Sampling gives false confidence** (a sampled batch still contains an error) | Medium | High | Sampling is explicitly not a guarantee; reports, critical-report auto-quarantine, withdrawal and version history keep the escape hatch | accepted-risk, documented |
| R-15 | **History deletion distorts analysis silently** | Medium | Medium | Deletion states consequences first, is transactional, leaves a tombstone, and derived analytics recompute from remaining data | resolved-by-design |
| R-16 | **Local single-user data loss** (disk, machine change) | Medium | High | Automatic + manual verified backups, documented retention, migration wizard with compatibility validation | resolved-by-design |

Resolution status column mirrors [AUDIT.md](../AUDIT.md): `resolved-by-design` means a documented
mechanism exists; `ongoing` means a later phase must verify it; `accepted-risk` means the limitation is
documented and deliberately kept.
