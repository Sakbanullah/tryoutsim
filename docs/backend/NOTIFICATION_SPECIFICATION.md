# Notification Center

Canonical source for **in-app notifications**: what the app tells the user after an asynchronous event,
how the shell surfaces it, and what is deliberately absent. Referenced by
[GENERATION_JOBS.md](./GENERATION_JOBS.md) §2, [DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md),
[QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6,
[API_ENDPOINTS.md](./API_ENDPOINTS.md) §9, [FRONTEND_PAGE_SPECIFICATIONS.md](../frontend/FRONTEND_PAGE_SPECIFICATIONS.md).

---

## 1. Scope

The notification centre exists because work continues **after the user leaves the screen**: generation
runs as a backend job, backups run on a schedule, validation and sampling finish later
([GENERATION_JOBS.md](./GENERATION_JOBS.md) §1). The centre is the single place those outcomes are
reported.

| In scope | Out of scope |
|---|---|
| In-app list, unread state, deep link to the affected record | OS / Windows toast notifications |
| Persisted events (§2) | Email, push, SMS, webhooks |
| Read/unread and dismissal | User-configurable notification rules in MVP |
| Survives browser close and app restart | Real-time push (the UI polls, §5) |

**No OS notifications.** The app never registers a Windows notification channel, never requests a
notification permission, and never plays an OS alert. The only surfaces are the in-app bell and the
screens a notification links to.

## 2. Event types

Every notification carries exactly one `type`. The set is closed; adding one is an API-contract change
([ERROR_HANDLING.md](./ERROR_HANDLING.md) §1 rule applied to enums, [AUDIT.md](../AUDIT.md)).

| `type` | Created when | Severity | Deep link |
|---|---|---|---|
| `generation_completed` | a generation job reaches `completed` | info | job detail (drafts) |
| `generation_failed` | a generation job reaches `failed` | error | job detail (failure reason) |
| `generation_interrupted` | a job was found non-resumable after restart ([GENERATION_JOBS.md](./GENERATION_JOBS.md) §5) | warning | job detail (retry action) |
| `batch_awaiting_sampling` | a batch finishes automated validation and needs user sampling ([QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6) | action | sampling screen |
| `validation_completed` | a validation run finishes for a batch or a set of drafts | info | validation summary |
| `backup_succeeded` | a scheduled or manual backup wrote and verified its archive | info | backup history |
| `backup_failed` | a backup **did not** complete (folder unavailable, write/verify error) | error | backup settings, with the reason |
| `restore_completed` | a restore finished and compatibility validation passed | info | backup history |
| `question_reported` | the user files a report on a question | info | question detail |
| `question_quarantined` | a question left the selectable pool (critical report auto-quarantine, or user action) | warning | question detail |

A notification is **never** the sole record of an event: it is a pointer. The authoritative state lives
in the owning record (job, batch, backup record, question). Deleting notifications never deletes those.

## 3. Record

```ts
type NotificationSeverity = 'info' | 'action' | 'warning' | 'error';

type Notification = {
  id: string;
  type: NotificationType;          // §2, closed set
  severity: NotificationSeverity;
  titleKey: string;                // message catalogue key, not free text
  params: Record<string, string | number>;   // values interpolated into the message
  link?: { route: string; entityId: string }; // client route + entity, no scores
  createdAt: string;               // ISO-8601 UTC
  readAt: string | null;           // null = unread
  dismissedAt: string | null;
};
```

- **Message text is a catalogue key + params**, so wording stays in one place and cannot drift per
  screen ([DESIGN_SYSTEM.md](../frontend/DESIGN_SYSTEM.md) §10 wording rules).
- `link.route` is a **relative client route**, never a URL with a query that carries data. The linked
  screen re-fetches its own contract ([FRONTEND_DATA_CONTRACTS.md](../frontend/FRONTEND_DATA_CONTRACTS.md) §1).
- A notification never carries a score, percentage or threshold verdict. Those are read from the owning
  contract on the linked screen.

## 4. Rules

1. **One notification per terminal outcome.** A job that fails two batches produces one
   `generation_failed` notification with the failed-batch count in `params`, not one per batch.
2. **Idempotent.** The producer writes at most one notification per `(type, entityId, outcome-revision)`;
   a repeated producer run does not duplicate. A retried job reuses the same notification and updates
   `readAt` back to `null`.
3. **Failure is never silent.** Any event that ends in failure (`backup_failed`, `generation_failed`,
   `question_quarantined`) must produce a notification. A success claim requires the owning record to
   show success ([DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md) §2.3).
4. **No secrets, no keys, no provider payloads.** `params` never contains an API key, a `keyLast4` alone
   is allowed, and never a raw provider response ([SECRETS.md](./SECRETS.md) §1).
5. **Retention** follows the backup/retention policy of the owning records; dismissed notifications are
   hidden but retained until the retention window closes.

## 5. Delivery model

- The backend writes the notification **inside the same transaction** that writes the terminal state of
  the owning record. There is no notification without its state.
- The frontend learns about new notifications by **polling** the notification list while the app is
  open ([FRONTEND_STATE_MANAGEMENT.md](../frontend/FRONTEND_STATE_MANAGEMENT.md)); there is no
  server-push channel in MVP.
- On app open, the shell fetches the unread count with the bootstrap payload
  ([API_ENDPOINTS.md](./API_ENDPOINTS.md) §1).
- Closing the browser loses nothing: the events are persisted (§3), not queued in the page.

## 6. Contracts

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | list, newest first; filters `unread`, `type`, `limit` |
| PATCH | `/notifications/:id` | mark read / dismissed |
| POST | `/notifications/read-all` | mark every unread as read |

Details, envelopes and error codes: [API_ENDPOINTS.md](./API_ENDPOINTS.md) §9,
[API_SPECIFICATION.md](./API_SPECIFICATION.md). The unread count is also part of `GET /bootstrap`.

## 7. Presentation

- The badge in the app shell shows the unread count as a number, with a text alternative
  ("3 pemberitahuan belum dibaca") — never colour alone
  ([FRONTEND_ACCESSIBILITY.md](../frontend/FRONTEND_ACCESSIBILITY.md) §3).
- `severity: 'action'` (sampling pending) is reachable from the badge and from the pending-actions block
  where one exists; it is never only in the list.
- A dismissed error notification does not hide the underlying failure from the owning screen.

## 8. What this file does not own

- When jobs run, why they fail, restart policy → [GENERATION_JOBS.md](./GENERATION_JOBS.md).
- Backup scheduling, success criteria, retention → [DEPLOYMENT_AND_BACKUP.md](../architecture/DEPLOYMENT_AND_BACKUP.md).
- Question report → quarantine rules → [QUESTION_SPECIFICATION.md](../examination/QUESTION_SPECIFICATION.md) §6.
