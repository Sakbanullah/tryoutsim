# Frontend Information Architecture

IA for the single-user app. Routes/screens are fixed here, not re-decided per page; page details are
[FRONTEND_PAGE_SPECIFICATIONS.md](./FRONTEND_PAGE_SPECIFICATIONS.md).

---

## 1. Top-level sections

| Section | Purpose | Icon/tone |
|---|---|---|
| **Dashboard** | Default landing: latest result, competency strength, weaknesses, recent, pending | overview |
| **Try Out** | Timed SKD drill, notice-first | timed test |
| **Latihan (Practice)** | Untimed by default, inline feedback | practice |
| **Bank Soal** | Browse/normalize active questions | library |
| **Analitik** | Metrics, trends, difficulty | charts (read analytics) |
| **Generasi** | AI question generation + review | generate |
| **Pengaturan AI** | Provider CRUD, model map, test | config |

## 2. Navigation

Persistent left/bottom nav (responsive), one section per item above. **Pengaturan AI** and
**Generasi** are grouped under "Alat"; **Bank Soal** and **Analitik** are "Review". No deep menu
nesting — every primary section is one tap from the shell.

## 3. Cross-cutting routes (not top-level sections)

| Route | Screen | Reached from |
|---|---|---|
| `/tryout/:id` | Test runner | Try Out |
| `/tryout/:id/result` | Result | runner completes |
| `/practice/:id` | Practice runner | Latihan or dashboard drill |
| `/questions/:id` | Question detail | Bank Soal / generation review |
| `/generation-jobs/:id/review` | Generation review | Generasi |
| `/analytics/:competencyId` | Competency drill-down | Analitik |
| `/exam-configs/:id` | Config detail + approval | Exam config |
| `/study-plan` | Study plan editor | Dashboard → personalised |

## 4. IA invariants

- The runner screens (`tryout`/`practice`) share the same component layout (FR-P3).
- No route exposes the answer key before submission; the result route owns key disclosure.
- The IA exposes exactly the shipped configs; an unoffered config is visible as locked context, not
  a startable option ([MVP_SCOPE](../product/MVP_SCOPE.md) §3).