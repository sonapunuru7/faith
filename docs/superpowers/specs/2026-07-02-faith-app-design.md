# Faith App — Product Requirements Document

**Date:** 2026-07-02
**Status:** Approved for planning

## 1. Overview

A mobile app that helps Christians build a daily habit of engaging with Scripture. Each day, users receive a shared verse of the day with short reflection prompts, can build a personal "Faith Journal" of annotated verses and notes (for use alongside sermons and prayer), and are visually motivated by a digital sheep mascot whose health reflects their consistency over time.

This is the author's first app project. It targets both iPhone and Android from the start, with an eventual public App Store / Play Store release as the goal.

## 2. Goals

- Build a repeatable daily habit of reading and reflecting on Scripture.
- Give users a private, lasting place to collect and annotate verses tied to sermons, prayers, and personal reflection.
- Make progress and consistency visible and emotionally motivating, without being punishing when a user misses a day.
- Ship a real, working v1 across both major mobile platforms without requiring the author to run or maintain backend server infrastructure.

## 3. Non-Goals (v1)

- Freehand drawing/annotation over verse text (structured highlight/underline/circle tools only in v1).
- A separate prayer request / gratitude log distinct from verse journaling.
- Multi-day themed reading plans.
- Personalizing the verse of the day per user (all users see the same verse each day in v1).
- Social features (sharing, following other users, comments).

These are captured in the Backlog (Section 7) for consideration after v1 ships.

## 4. Target Users

Christians who want a consistent daily Scripture habit and a digital alternative (or companion) to a paper devotional journal, used alongside sermons, personal prayer, and Bible study. v1 targets individual use; there is no multi-user/social layer.

## 5. Technical Approach

**Platform:** React Native via Expo (managed workflow) — a single codebase targeting both iOS and Android, chosen because the author intends to support both platforms and has an existing Python/Java/C#-adjacent coding background rather than JavaScript-specific experience; Expo minimizes native build complexity for a first mobile project.

**Authentication:** Firebase Authentication, using Sign in with Apple (iOS) and Sign in with Google (Android) as providers, so a user's data follows them across devices and reinstalls.

**Data storage & sync:** Firebase Firestore. No custom backend server is built or hosted — Firestore is the sole persistence layer, accessed directly from the client via the Firebase SDK and secured with Firestore security rules scoped to the authenticated user's own documents.

**Bible content:** Verse text is fetched at runtime from an external Bible API (e.g. API.Bible) rather than bundled in the app, because users must be able to switch translations freely. Faith Journal entries snapshot the verse text at creation time (see Data Model) so saved entries remain stable and viewable even if the source translation is later unavailable or changed.

**Notifications:** Expo's local notification APIs schedule the daily reminder on-device. No push notification backend is required for v1, since reminders are per-device and don't depend on server-triggered events.

**Sheep animation:** A single Rive or Lottie animation asset authored with a continuous, scrubbable progress range. The app drives the animation's playback position directly from the user's `wellnessScore` (0–100), producing a smooth, continuously-varying appearance without requiring hand-drawn art for every possible state.

## 6. Data Model (Firestore)

### `users/{uid}`
One document per user; profile, settings, and streak/wellness state.

| Field | Type | Notes |
|---|---|---|
| `displayName`, `email` | string | From auth provider |
| `preferredTranslation` | string | e.g. `"NIV"`, `"ESV"`, `"KJV"`; user-changeable in settings |
| `notificationTime` | string | e.g. `"07:30"`; local time for daily reminder |
| `currentStreak` | int | Consecutive engaged days, subject to grace period |
| `longestStreak` | int | All-time best streak |
| `missedDaysInARow` | int | Drives grace-period logic (see Section 8) |
| `wellnessScore` | float, 0–100 | Continuous value driving the sheep animation |
| `lastEngagedDate` | date | Most recent day counted as engaged |
| `createdAt` | timestamp | |

### `dailyVerses/{date}`
Global collection, shared across all users; one document per calendar date.

| Field | Type | Notes |
|---|---|---|
| `reference` | string | e.g. `"Philippians 4:6-7"` |
| `journalPrompts` | array of string | 2–3 short reflection prompts for that day |

### `users/{uid}/engagement/{date}`
Subcollection; one document per user per calendar date. Tracks daily habit activity and is the sole source read by both the streak/wellness calculation and the streak calendar view (Section 7) — no separate storage is needed for the calendar.

| Field | Type | Notes |
|---|---|---|
| `viewedVerse` | bool | True once the user opens that day's verse |
| `journalAnswers` | map (promptId → string) | Answers to that day's reflection prompts |
| `completedAt` | timestamp | Set when the day is first counted as engaged |

### `users/{uid}/journalEntries/{entryId}`
Subcollection; the user's Faith Journal entries.

| Field | Type | Notes |
|---|---|---|
| `title` | string, optional | e.g. `"Sunday sermon notes"` |
| `verseReferences` | array of string | Verses included in this entry |
| `verseText` | string | Snapshotted at creation time, in the translation used then |
| `translation` | string | Translation code used for the snapshot |
| `annotations` | array of `{ type, color, range }` | `type` ∈ `highlight`, `underline`, `circle` in v1; `range` is a character offset pair into `verseText` |
| `freeformNotes` | string | Free-text prayer/sermon reflection alongside the verse |
| `tags` | array of string | User-defined tags, used by search |
| `isFavorite` | bool | Powers the Favorites view |
| `createdAt`, `updatedAt` | timestamp | |

Search and Favorites (Section 7) both query `journalEntries` directly (by `tags`/text match, and by `isFavorite`, respectively); neither requires its own collection.

## 7. Features (v1)

### Verse of the Day + Journal Prompts
Every user is shown the same verse each day, sourced from `dailyVerses/{date}` and rendered in their `preferredTranslation` via a live Bible API call. Below the verse, 2–3 short prompts ask the user to connect it to their day (e.g. "Where did you see this today?"). Answers are saved to that day's `engagement` document. Either viewing the verse or completing the prompts counts as that day being "engaged."

### Faith Journal
Users build entries by pasting in one or more verses and annotating them with structured tools: tapping a phrase applies a highlight (with color choice), underline, or circle outline. A free-text area alongside holds prayer or sermon notes. Entries can be tagged and marked as favorites. Freehand drawing annotation is deferred to v2 (see Section 8); the `annotations` schema is designed to accept an additional annotation type later without migration.

### The Sheep (accountability mascot)
A Rive/Lottie animation whose playback position is driven continuously by `wellnessScore`. Any day's engagement (verse view or prompt completion) raises the score; a missed day lowers it, but gently — a single missed day only dims the sheep slightly and does not reset `currentStreak`; real visual decline begins only after 2 or more consecutive missed days (tracked via `missedDaysInARow`). There is no hard reset to a "zero" state, so a difficult week does not erase visible progress built over months.

### Streak Calendar
A month-grid view, similar to a habit-tracker/contribution graph, rendered directly from the `engagement` subcollection: filled cells for engaged days, empty for missed days, with current and longest streaks shown above the grid.

### Search & Favorites
A search interface over `journalEntries` (matching tags, verse reference, or note text), plus a dedicated Favorites view filtering entries where `isFavorite` is true.

### Daily Reminder
One local notification per day, at a time the user sets in settings (default suggested, but user-configurable), reading "Your verse of the day is ready." Scheduled entirely on-device via Expo's notification APIs; no server-triggered push is required.

## 8. Grace Period Logic (Sheep & Streak)

- Each day a user engages (views the verse or completes prompts), `wellnessScore` increases, `currentStreak` increments, and `missedDaysInARow` resets to 0.
- After a single missed day, `missedDaysInARow` becomes 1: `wellnessScore` dips slightly, but `currentStreak` is **not** reset.
- After 2 or more consecutive missed days, `wellnessScore` declines more visibly for each additional missed day, and `currentStreak` resets to 0 on the day the user next engages.
- `longestStreak` is never decreased; it only updates upward when `currentStreak` surpasses it.

## 9. Backlog (v2+, deferred from v1)

- Freehand drawing/annotation over verse text (finger or stylus marking, like a physical Bible).
- Prayer request / gratitude log, kept separate from verse-based journaling.
- Multi-day themed reading plans (e.g. a 7-day series on a topic), in place of a single unconnected daily verse.
- Personalizing the verse of the day per user rather than showing the same verse to everyone.
- Social/sharing features.

## 10. Open Risks / Considerations for Implementation Planning

- Bible API selection (e.g. API.Bible vs. alternatives) needs to be finalized based on translation coverage, licensing terms for the translations the app wants to support, and rate limits — to be resolved during implementation planning, not left to runtime.
- Firestore security rules must ensure a user can only read/write their own `users/{uid}` document and its subcollections.
- Rive vs. Lottie for the sheep animation should be chosen based on asset availability/cost during implementation planning; both are compatible with the continuous-progress approach described in Section 5.
