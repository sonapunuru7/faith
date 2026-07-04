# Faith App — Phase 3: Sheep Mascot + Streak Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute and persist the user's streak/wellness state per the PRD's grace-period rules, then surface it on `HomeScreen` as a mascot visual and a month-grid streak calendar, both driven by data already being written to `users/{uid}/engagement` since Phase 2.

**Architecture:** A pure, heavily-tested `computeEngagementUpdate` function implements the grace-period state machine in isolation from Firestore. A thin `recordEngagement` orchestrator reads the user's current state, runs it through that pure function, and saves the result — called best-effort from `HomeScreen` alongside the existing `markVerseViewed` call, using the same fire-and-forget pattern already established there (a lesson from a Phase 2 bug: a failed secondary write must never clobber the primary content). Two new presentational components (`SheepMascot`, `StreakCalendar`) render the resulting state; `HomeScreen` stays an orchestrator, delegating rendering to them.

**Tech Stack:** Same as Phase 1/2 (Expo/TypeScript, Firebase JS SDK, Jest + `@testing-library/react-native`). No new dependencies.

**Out of scope for this phase (deferred):** A real Rive/Lottie animation for the sheep (no asset exists yet — this phase ships a placeholder visual whose only job is to react to `wellnessScore`; swapping its internals for real animation playback later is a self-contained follow-up). Faith Journal entries, Search/Favorites, and any settings/translation UI remain separate, unscheduled PRD features. Calendar month navigation (prev/next month) is not built — this phase shows the current month only.

## Global Constraints

- All constraints from the Phase 1 and Phase 2 plans still apply (TypeScript throughout, `EXPO_PUBLIC_*` env var prefix, Jest with `jest-expo` + `@testing-library/react-native`, credentials never committed).
- The PRD's grace-period rules (Section 8) specify direction ("increases", "dips slightly", "declines more visibly") but not exact numbers — this plan finalizes them as constants, the single source of truth going forward:
  - `ENGAGE_BONUS = 10` (wellness points gained per day engaged)
  - `MISS_PENALTY_PER_DAY = 5` (wellness points lost per consecutive missed day)
  - `MAX_MISS_PENALTY = 30` (the penalty for any single re-engagement is capped here, however long the gap — this is what "no hard reset to a zero state" means in practice: even a month-long absence only costs 30 points, not everything)
  - `wellnessScore` is always clamped to `[0, 100]`
  - A brand-new user (no profile document yet) starts from `wellnessScore: 50, currentStreak: 0, longestStreak: 0, missedDaysInARow: 0, lastEngagedDate: ''`
- Missing exactly one day does **not** reset `currentStreak` (per PRD §8); missing two or more consecutive days resets it to `1` on the day the user next engages (not `0` — that day's engagement counts).
- `longestStreak` only ever increases, never decreases.
- All streak/wellness state lives on the existing `users/{uid}` document (the same one `UserProfile` in `src/types/models.ts` describes) — this phase reads/writes only the five wellness-related fields via partial `{ merge: true }` writes; it does not create `displayName`, `email`, `preferredTranslation`, `notificationTime`, or `createdAt` (those aren't populated by any code yet and remain out of scope here).
- No new Firestore security rules are needed — the existing `users/{userId}` rule (`allow read, write: if request.auth != null && request.auth.uid == userId`) already covers this.
- Any Firestore write or read added by this phase that isn't the primary verse-loading flow must be best-effort (`.catch(() => {})`) and must never change `HomeScreen`'s `status` state or trigger `showAlert` — this is the exact class of bug found and fixed in Phase 2 (a failed secondary write clobbering a successfully-rendered verse).

---

### Task 1: Wellness state type and grace-period calculation

**Files:**
- Create: `app/src/wellness/wellnessState.ts`
- Create: `app/src/wellness/computeEngagementUpdate.ts`
- Test: `app/__tests__/computeEngagementUpdate.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `WellnessState` interface and `DEFAULT_WELLNESS_STATE` constant from `app/src/wellness/wellnessState.ts`; `computeEngagementUpdate(previous: WellnessState, today: string): WellnessState` from `app/src/wellness/computeEngagementUpdate.ts` — Task 3's `recordEngagement` calls this directly.

- [ ] **Step 1: Write the failing tests**

Create `app/src/wellness/wellnessState.ts` first (just the type/constant the tests import — no logic yet):
```typescript
export interface WellnessState {
  currentStreak: number;
  longestStreak: number;
  missedDaysInARow: number;
  wellnessScore: number;
  lastEngagedDate: string;
}

export const DEFAULT_WELLNESS_STATE: WellnessState = {
  currentStreak: 0,
  longestStreak: 0,
  missedDaysInARow: 0,
  wellnessScore: 50,
  lastEngagedDate: '',
};
```

Create `app/__tests__/computeEngagementUpdate.test.ts`:
```typescript
import { computeEngagementUpdate } from '../src/wellness/computeEngagementUpdate';
import { DEFAULT_WELLNESS_STATE, WellnessState } from '../src/wellness/wellnessState';

describe('computeEngagementUpdate', () => {
  test('a brand new user engaging for the first time starts a streak of 1', () => {
    const result = computeEngagementUpdate(DEFAULT_WELLNESS_STATE, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      missedDaysInARow: 0,
      wellnessScore: 60,
      lastEngagedDate: '2026-07-04',
    });
  });

  test('engaging again on a day already counted is a no-op', () => {
    const previous: WellnessState = {
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-04',
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual(previous);
  });

  test('engaging on the very next day continues the streak and raises the score', () => {
    const previous: WellnessState = {
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-03',
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 80,
      lastEngagedDate: '2026-07-04',
    });
  });

  test('missing exactly one day dips the score but does not reset the streak', () => {
    const previous: WellnessState = {
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 1,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-02', // one day (07-03) was missed before today
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 75, // 70 - 5 (one missed day) + 10 (today)
      lastEngagedDate: '2026-07-04',
    });
  });

  test('missing two or more days resets the streak to 1 but keeps the longest streak', () => {
    const previous: WellnessState = {
      currentStreak: 9,
      longestStreak: 9,
      missedDaysInARow: 3,
      wellnessScore: 70,
      lastEngagedDate: '2026-06-30', // three days missed: 07-01, 07-02, 07-03
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result).toEqual({
      currentStreak: 1,
      longestStreak: 9,
      missedDaysInARow: 0,
      wellnessScore: 65, // 70 - 15 (3 missed days x 5) + 10
      lastEngagedDate: '2026-07-04',
    });
  });

  test('a very long gap never drops the score to zero in one step, because the penalty is capped', () => {
    const previous: WellnessState = {
      currentStreak: 20,
      longestStreak: 20,
      missedDaysInARow: 10,
      wellnessScore: 25,
      lastEngagedDate: '2026-06-01', // over a month missed
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result.wellnessScore).toBe(10); // penalty capped at 30, floors at 0, then +10
    expect(result.currentStreak).toBe(1);
    expect(result.longestStreak).toBe(20);
  });

  test('wellness score never exceeds 100', () => {
    const previous: WellnessState = {
      currentStreak: 5,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 95,
      lastEngagedDate: '2026-07-03',
    };

    const result = computeEngagementUpdate(previous, '2026-07-04');

    expect(result.wellnessScore).toBe(100);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- computeEngagementUpdate.test.ts`
Expected: FAIL — cannot find module `../src/wellness/computeEngagementUpdate`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/wellness/computeEngagementUpdate.ts`:
```typescript
import { WellnessState } from './wellnessState';

const ENGAGE_BONUS = 10;
const MISS_PENALTY_PER_DAY = 5;
const MAX_MISS_PENALTY = 30;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function daysBetween(fromDateString: string, toDateString: string): number {
  const from = new Date(`${fromDateString}T00:00:00`);
  const to = new Date(`${toDateString}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeEngagementUpdate(previous: WellnessState, today: string): WellnessState {
  if (previous.lastEngagedDate === today) {
    return previous;
  }

  const missedDays = previous.lastEngagedDate
    ? Math.max(0, daysBetween(previous.lastEngagedDate, today) - 1)
    : 0;

  const penalty = Math.min(MAX_MISS_PENALTY, MISS_PENALTY_PER_DAY * missedDays);
  const scoreAfterMiss = Math.max(MIN_SCORE, previous.wellnessScore - penalty);
  const wellnessScore = Math.min(MAX_SCORE, scoreAfterMiss + ENGAGE_BONUS);

  const currentStreak = missedDays >= 2 ? 1 : previous.currentStreak + 1;
  const longestStreak = Math.max(previous.longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    missedDaysInARow: 0,
    wellnessScore,
    lastEngagedDate: today,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- computeEngagementUpdate.test.ts`
Expected: PASS (7 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/wellness/wellnessState.ts app/src/wellness/computeEngagementUpdate.ts app/__tests__/computeEngagementUpdate.test.ts
git commit -m "feat: add wellness state type and grace-period calculation"
```

---

### Task 2: Firestore wellness state read/write helpers

**Files:**
- Create: `app/src/firebase/userProfile.ts`
- Test: `app/__tests__/userProfile.test.ts`

**Interfaces:**
- Consumes: `db` from `app/src/firebase/config.ts` (Phase 1 Task 2); `WellnessState`, `DEFAULT_WELLNESS_STATE` from `app/src/wellness/wellnessState.ts` (Task 1)
- Produces: `fetchWellnessState(uid: string): Promise<WellnessState>` and `saveWellnessState(uid: string, state: WellnessState): Promise<void>` from `app/src/firebase/userProfile.ts` — Task 3's `recordEngagement` and Task 7's `HomeScreen` call these directly.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/userProfile.test.ts`:
```typescript
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { fetchWellnessState, saveWellnessState } from '../src/firebase/userProfile';
import { DEFAULT_WELLNESS_STATE } from '../src/wellness/wellnessState';

describe('fetchWellnessState', () => {
  test('returns the stored wellness fields when the profile document exists', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        currentStreak: 4,
        longestStreak: 9,
        missedDaysInARow: 0,
        wellnessScore: 75,
        lastEngagedDate: '2026-07-04',
        displayName: 'Alice',
      }),
    });

    const result = await fetchWellnessState('alice');

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice');
    expect(result).toEqual({
      currentStreak: 4,
      longestStreak: 9,
      missedDaysInARow: 0,
      wellnessScore: 75,
      lastEngagedDate: '2026-07-04',
    });
  });

  test('returns the default wellness state when no profile document exists yet', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const result = await fetchWellnessState('brand-new-uid');

    expect(result).toEqual(DEFAULT_WELLNESS_STATE);
  });
});

describe('saveWellnessState', () => {
  test('merges the wellness fields into the user profile document', async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    const state = {
      currentStreak: 4,
      longestStreak: 9,
      missedDaysInARow: 0,
      wellnessScore: 75,
      lastEngagedDate: '2026-07-04',
    };

    await saveWellnessState('alice', state);

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice');
    expect(setDoc).toHaveBeenCalledWith({ path: 'users/alice' }, state, { merge: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- userProfile.test.ts`
Expected: FAIL — cannot find module `../src/firebase/userProfile`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/firebase/userProfile.ts`:
```typescript
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './config';
import { DEFAULT_WELLNESS_STATE, WellnessState } from '../wellness/wellnessState';

export async function fetchWellnessState(uid: string): Promise<WellnessState> {
  const snapshot = await getDoc(doc(db, 'users', uid));
  if (!snapshot.exists()) {
    return DEFAULT_WELLNESS_STATE;
  }
  const data = snapshot.data();
  return {
    currentStreak: data.currentStreak ?? DEFAULT_WELLNESS_STATE.currentStreak,
    longestStreak: data.longestStreak ?? DEFAULT_WELLNESS_STATE.longestStreak,
    missedDaysInARow: data.missedDaysInARow ?? DEFAULT_WELLNESS_STATE.missedDaysInARow,
    wellnessScore: data.wellnessScore ?? DEFAULT_WELLNESS_STATE.wellnessScore,
    lastEngagedDate: data.lastEngagedDate ?? DEFAULT_WELLNESS_STATE.lastEngagedDate,
  };
}

export async function saveWellnessState(uid: string, state: WellnessState): Promise<void> {
  await setDoc(doc(db, 'users', uid), state, { merge: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- userProfile.test.ts`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/firebase/userProfile.ts app/__tests__/userProfile.test.ts
git commit -m "feat: add Firestore read/write helpers for the wellness profile"
```

---

### Task 3: Engagement-recording orchestrator

**Files:**
- Create: `app/src/wellness/recordEngagement.ts`
- Test: `app/__tests__/recordEngagement.test.ts`

**Interfaces:**
- Consumes: `fetchWellnessState`, `saveWellnessState` from `app/src/firebase/userProfile.ts` (Task 2); `computeEngagementUpdate` from `app/src/wellness/computeEngagementUpdate.ts` (Task 1)
- Produces: `recordEngagement(uid: string, today: string): Promise<WellnessState>` from `app/src/wellness/recordEngagement.ts` — Task 7's `HomeScreen` calls this directly, best-effort, and uses its resolved value to update the displayed wellness state.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/recordEngagement.test.ts`:
```typescript
jest.mock('../src/firebase/userProfile', () => ({
  fetchWellnessState: jest.fn(),
  saveWellnessState: jest.fn(),
}));

import { fetchWellnessState, saveWellnessState } from '../src/firebase/userProfile';
import { recordEngagement } from '../src/wellness/recordEngagement';

describe('recordEngagement', () => {
  test('computes the next wellness state from the stored one, saves it, and returns it', async () => {
    (fetchWellnessState as jest.Mock).mockResolvedValue({
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 70,
      lastEngagedDate: '2026-07-03',
    });
    (saveWellnessState as jest.Mock).mockResolvedValue(undefined);

    const result = await recordEngagement('alice', '2026-07-04');

    const expectedNext = {
      currentStreak: 4,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 80,
      lastEngagedDate: '2026-07-04',
    };

    expect(fetchWellnessState).toHaveBeenCalledWith('alice');
    expect(saveWellnessState).toHaveBeenCalledWith('alice', expectedNext);
    expect(result).toEqual(expectedNext);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- recordEngagement.test.ts`
Expected: FAIL — cannot find module `../src/wellness/recordEngagement`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/wellness/recordEngagement.ts`:
```typescript
import { fetchWellnessState, saveWellnessState } from '../firebase/userProfile';
import { computeEngagementUpdate } from './computeEngagementUpdate';
import { WellnessState } from './wellnessState';

export async function recordEngagement(uid: string, today: string): Promise<WellnessState> {
  const previous = await fetchWellnessState(uid);
  const next = computeEngagementUpdate(previous, today);
  await saveWellnessState(uid, next);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- recordEngagement.test.ts`
Expected: PASS (1 test passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/wellness/recordEngagement.ts app/__tests__/recordEngagement.test.ts
git commit -m "feat: add engagement-recording orchestrator for wellness state"
```

---

### Task 4: Sheep mascot placeholder component

**Files:**
- Create: `app/src/components/SheepMascot.tsx`
- Test: `app/__tests__/SheepMascot.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: `SheepMascot({ wellnessScore: number })` (default export: named export `SheepMascot`) from `app/src/components/SheepMascot.tsx` — Task 7's `HomeScreen` renders this directly.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/SheepMascot.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { SheepMascot } from '../src/components/SheepMascot';

describe('SheepMascot', () => {
  test('renders at full opacity for a perfect wellness score', () => {
    render(<SheepMascot wellnessScore={100} />);

    expect(screen.getByTestId('sheep-mascot').props.style.opacity).toBe(1);
  });

  test('renders dimmed but still visible for a wellness score of zero', () => {
    render(<SheepMascot wellnessScore={0} />);

    expect(screen.getByTestId('sheep-mascot').props.style.opacity).toBe(0.3);
  });

  test('clamps out-of-range scores instead of rendering invalid opacity', () => {
    render(<SheepMascot wellnessScore={150} />);

    expect(screen.getByTestId('sheep-mascot').props.style.opacity).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- SheepMascot.test.tsx`
Expected: FAIL — cannot find module `../src/components/SheepMascot`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/components/SheepMascot.tsx`:
```tsx
import { View, Text } from 'react-native';

// Placeholder visual until a real Rive/Lottie asset exists — swapping this
// component's internals for real animation playback driven by the same
// wellnessScore prop is a self-contained follow-up change.
export function SheepMascot({ wellnessScore }: { wellnessScore: number }) {
  const clamped = Math.max(0, Math.min(100, wellnessScore));
  const opacity = 0.3 + (clamped / 100) * 0.7;

  return (
    <View testID="sheep-mascot" style={{ opacity }}>
      <Text style={{ fontSize: 64 }}>🐑</Text>
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- SheepMascot.test.tsx`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/components/SheepMascot.tsx app/__tests__/SheepMascot.test.tsx
git commit -m "feat: add placeholder sheep mascot component"
```

---

### Task 5: Engagement-calendar Firestore query helper

**Files:**
- Create: `app/src/firebase/engagementCalendar.ts`
- Test: `app/__tests__/engagementCalendar.test.ts`

**Interfaces:**
- Consumes: `db` from `app/src/firebase/config.ts` (Phase 1 Task 2)
- Produces: `fetchEngagedDatesInMonth(uid: string, year: number, month: number): Promise<Set<string>>` (month is 1-12) from `app/src/firebase/engagementCalendar.ts` — Task 7's `HomeScreen` calls this directly.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/engagementCalendar.test.ts`:
```typescript
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  documentId: jest.fn(() => '__name__'),
  getDocs: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { collection, where, documentId, getDocs } from 'firebase/firestore';
import { fetchEngagedDatesInMonth } from '../src/firebase/engagementCalendar';

describe('fetchEngagedDatesInMonth', () => {
  test('returns the set of dates in that month where the verse was viewed', async () => {
    (getDocs as jest.Mock).mockResolvedValue({
      forEach: (callback: (doc: { id: string; data: () => { viewedVerse: boolean } }) => void) => {
        callback({ id: '2026-07-01', data: () => ({ viewedVerse: true }) });
        callback({ id: '2026-07-02', data: () => ({ viewedVerse: false }) });
        callback({ id: '2026-07-03', data: () => ({ viewedVerse: true }) });
      },
    });

    const result = await fetchEngagedDatesInMonth('alice', 2026, 7);

    expect(collection).toHaveBeenCalledWith({}, 'users', 'alice', 'engagement');
    expect(where).toHaveBeenCalledWith(documentId(), '>=', '2026-07-01');
    expect(where).toHaveBeenCalledWith(documentId(), '<=', '2026-07-31');
    expect(result).toEqual(new Set(['2026-07-01', '2026-07-03']));
  });

  test('zero-pads single-digit months', async () => {
    (getDocs as jest.Mock).mockResolvedValue({ forEach: () => {} });

    await fetchEngagedDatesInMonth('alice', 2026, 1);

    expect(where).toHaveBeenCalledWith(documentId(), '>=', '2026-01-01');
    expect(where).toHaveBeenCalledWith(documentId(), '<=', '2026-01-31');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- engagementCalendar.test.ts`
Expected: FAIL — cannot find module `../src/firebase/engagementCalendar`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/firebase/engagementCalendar.ts`:
```typescript
import { collection, query, where, documentId, getDocs } from 'firebase/firestore';
import { db } from './config';

// Document IDs in this subcollection are YYYY-MM-DD date strings (see Phase
// 2's engagement.ts), so a range filter on documentId() finds every doc in
// the given month — no separate date field needed, and Firestore doesn't
// require a composite index for a single inequality on one field.
export async function fetchEngagedDatesInMonth(
  uid: string,
  year: number,
  month: number
): Promise<Set<string>> {
  const monthStr = String(month).padStart(2, '0');
  const start = `${year}-${monthStr}-01`;
  const end = `${year}-${monthStr}-31`;

  const engagementRef = collection(db, 'users', uid, 'engagement');
  const monthQuery = query(
    engagementRef,
    where(documentId(), '>=', start),
    where(documentId(), '<=', end)
  );
  const snapshot = await getDocs(monthQuery);

  const engagedDates = new Set<string>();
  snapshot.forEach((docSnap: { id: string; data: () => { viewedVerse?: boolean } }) => {
    if (docSnap.data().viewedVerse) {
      engagedDates.add(docSnap.id);
    }
  });
  return engagedDates;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- engagementCalendar.test.ts`
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/firebase/engagementCalendar.ts app/__tests__/engagementCalendar.test.ts
git commit -m "feat: add Firestore query helper for a month's engaged dates"
```

---

### Task 6: Streak calendar component

**Files:**
- Create: `app/src/components/StreakCalendar.tsx`
- Test: `app/__tests__/StreakCalendar.test.tsx`

**Interfaces:**
- Consumes: none
- Produces: `StreakCalendar({ year: number; month: number; engagedDates: Set<string>; currentStreak: number; longestStreak: number })` from `app/src/components/StreakCalendar.tsx` — Task 7's `HomeScreen` renders this directly.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/StreakCalendar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { StreakCalendar } from '../src/components/StreakCalendar';

describe('StreakCalendar', () => {
  test('renders the current and longest streak counts', () => {
    render(
      <StreakCalendar
        year={2026}
        month={7}
        engagedDates={new Set(['2026-07-01'])}
        currentStreak={4}
        longestStreak={9}
      />
    );

    expect(screen.getByText('Current streak: 4')).toBeTruthy();
    expect(screen.getByText('Longest streak: 9')).toBeTruthy();
  });

  test('renders one cell per day in the month, colored by engagement', () => {
    render(
      <StreakCalendar
        year={2026}
        month={7}
        engagedDates={new Set(['2026-07-01', '2026-07-15'])}
        currentStreak={1}
        longestStreak={1}
      />
    );

    expect(screen.getByTestId('calendar-day-2026-07-31')).toBeTruthy();
    expect(screen.getByTestId('calendar-day-2026-07-01').props.style.backgroundColor).toBe(
      '#4CAF50'
    );
    expect(screen.getByTestId('calendar-day-2026-07-02').props.style.backgroundColor).toBe(
      '#E0E0E0'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- StreakCalendar.test.tsx`
Expected: FAIL — cannot find module `../src/components/StreakCalendar`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/components/StreakCalendar.tsx`:
```tsx
import { View, Text } from 'react-native';

interface StreakCalendarProps {
  year: number;
  month: number;
  engagedDates: Set<string>;
  currentStreak: number;
  longestStreak: number;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function StreakCalendar({
  year,
  month,
  engagedDates,
  currentStreak,
  longestStreak,
}: StreakCalendarProps) {
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, index) => index + 1);

  return (
    <View testID="streak-calendar">
      <Text>Current streak: {currentStreak}</Text>
      <Text>Longest streak: {longestStreak}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day) => {
          const date = dateString(year, month, day);
          const engaged = engagedDates.has(date);
          return (
            <View
              key={date}
              testID={`calendar-day-${date}`}
              style={{
                width: 24,
                height: 24,
                margin: 2,
                backgroundColor: engaged ? '#4CAF50' : '#E0E0E0',
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test -- StreakCalendar.test.tsx`
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/components/StreakCalendar.tsx app/__tests__/StreakCalendar.test.tsx
git commit -m "feat: add streak calendar component"
```

---

### Task 7: Wire the sheep and streak calendar into HomeScreen

**Files:**
- Modify: `app/src/screens/HomeScreen.tsx`
- Modify: `app/__tests__/HomeScreen.test.tsx`
- Modify: `app/__tests__/RootNavigator.test.tsx`

**Interfaces:**
- Consumes: `fetchWellnessState` from `app/src/firebase/userProfile.ts` (Task 2); `recordEngagement` from `app/src/wellness/recordEngagement.ts` (Task 3); `DEFAULT_WELLNESS_STATE`, `WellnessState` from `app/src/wellness/wellnessState.ts` (Task 1); `SheepMascot` from `app/src/components/SheepMascot.tsx` (Task 4); `fetchEngagedDatesInMonth` from `app/src/firebase/engagementCalendar.ts` (Task 5); `StreakCalendar` from `app/src/components/StreakCalendar.tsx` (Task 6)
- Produces: updated `HomeScreen` component — this is the last task in this phase, nothing downstream depends on new exports from it.

- [ ] **Step 1: Write the failing tests**

`HomeScreen.test.tsx` needs new mocks for the two new Firestore modules this task wires in (`userProfile`, `engagementCalendar`) alongside its existing ones, plus two new tests. Replace `app/__tests__/HomeScreen.test.tsx`:
```tsx
jest.mock('../src/firebase/config', () => ({ auth: { currentUser: { uid: 'alice' } } }));

jest.mock('../src/firebase/dailyVerse', () => ({
  fetchDailyVerseDoc: jest.fn(),
}));

jest.mock('../src/firebase/engagement', () => ({
  markVerseViewed: jest.fn().mockResolvedValue(undefined),
  saveJournalAnswers: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/api/bibleApi', () => ({
  fetchVerseText: jest.fn(),
  BibleApiError: class BibleApiError extends Error {},
}));

jest.mock('../src/notifications/dailyReminder', () => ({
  scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/firebase/userProfile', () => ({
  fetchWellnessState: jest.fn().mockResolvedValue({
    currentStreak: 0,
    longestStreak: 0,
    missedDaysInARow: 0,
    wellnessScore: 50,
    lastEngagedDate: '',
  }),
  saveWellnessState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/firebase/engagementCalendar', () => ({
  fetchEngagedDatesInMonth: jest.fn().mockResolvedValue(new Set()),
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { fetchDailyVerseDoc } from '../src/firebase/dailyVerse';
import { markVerseViewed, saveJournalAnswers } from '../src/firebase/engagement';
import { fetchVerseText } from '../src/api/bibleApi';
import { fetchWellnessState } from '../src/firebase/userProfile';
import { getTodayDateString } from '../src/utils/date';
import { HomeScreen } from '../src/screens/HomeScreen';

describe('HomeScreen', () => {
  beforeEach(() => {
    (fetchDailyVerseDoc as jest.Mock).mockReset();
    (fetchVerseText as jest.Mock).mockReset();
    (markVerseViewed as jest.Mock).mockClear();
    (saveJournalAnswers as jest.Mock).mockClear();
    (fetchWellnessState as jest.Mock).mockClear();
    (fetchWellnessState as jest.Mock).mockResolvedValue({
      currentStreak: 0,
      longestStreak: 0,
      missedDaysInARow: 0,
      wellnessScore: 50,
      lastEngagedDate: '',
    });
  });

  test('shows the verse, reference, and prompts once loaded, and marks it viewed', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockResolvedValue('Do not be anxious about anything...');

    render(<HomeScreen />);

    expect(await screen.findByText('Philippians 4:6-7')).toBeTruthy();
    expect(await screen.findByText('Do not be anxious about anything...')).toBeTruthy();
    expect(await screen.findByText('Where did you see this today?')).toBeTruthy();
    await waitFor(() => expect(markVerseViewed).toHaveBeenCalledWith('alice', expect.any(String)));
  });

  test('shows a fallback message when no verse is set for today', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue(null);

    render(<HomeScreen />);

    expect(await screen.findByText(/isn.t available yet/i)).toBeTruthy();
  });

  test('shows an error message if the verse text fails to load', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockRejectedValue(new Error('boom'));

    render(<HomeScreen />);

    expect(await screen.findByText(/something went wrong/i)).toBeTruthy();
  });

  test('saves reflections when the save button is pressed', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockResolvedValue('Do not be anxious about anything...');

    render(<HomeScreen />);

    const input = await screen.findByTestId('journal-answer-0');
    fireEvent.changeText(input, 'Grateful for rest.');
    fireEvent.press(screen.getByText('Save reflections'));

    await waitFor(() =>
      expect(saveJournalAnswers).toHaveBeenCalledWith('alice', expect.any(String), {
        '0': 'Grateful for rest.',
      })
    );
  });

  test('renders the sheep mascot and streak calendar even when no verse is set for today', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue(null);

    render(<HomeScreen />);

    await screen.findByText(/isn.t available yet/i);

    expect(screen.getByTestId('sheep-mascot')).toBeTruthy();
    expect(screen.getByTestId('streak-calendar')).toBeTruthy();
  });

  test('updates the sheep and streak once the day is recorded as engaged', async () => {
    (fetchDailyVerseDoc as jest.Mock).mockResolvedValue({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
    (fetchVerseText as jest.Mock).mockResolvedValue('Do not be anxious about anything...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = getTodayDateString(yesterday);

    (fetchWellnessState as jest.Mock).mockResolvedValue({
      currentStreak: 3,
      longestStreak: 5,
      missedDaysInARow: 0,
      wellnessScore: 70,
      lastEngagedDate: yesterdayString,
    });

    render(<HomeScreen />);

    await screen.findByText('Philippians 4:6-7');

    await waitFor(() => expect(screen.getByText('Current streak: 4')).toBeTruthy());
    expect(screen.getByText('Longest streak: 5')).toBeTruthy();
  });
});
```

`RootNavigator.test.tsx`'s "shows the home screen" case renders the real `HomeScreen` above, which now also needs the two new modules mocked. Replace `app/__tests__/RootNavigator.test.tsx`:
```tsx
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ auth: { currentUser: { uid: 'alice' } } }));

jest.mock('../src/firebase/dailyVerse', () => ({
  fetchDailyVerseDoc: jest.fn().mockResolvedValue(null),
}));

jest.mock('../src/firebase/engagement', () => ({
  markVerseViewed: jest.fn().mockResolvedValue(undefined),
  saveJournalAnswers: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/notifications/dailyReminder', () => ({
  scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/firebase/userProfile', () => ({
  fetchWellnessState: jest.fn().mockResolvedValue({
    currentStreak: 0,
    longestStreak: 0,
    missedDaysInARow: 0,
    wellnessScore: 50,
    lastEngagedDate: '',
  }),
  saveWellnessState: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/firebase/engagementCalendar', () => ({
  fetchEngagedDatesInMonth: jest.fn().mockResolvedValue(new Set()),
}));

import { render, screen } from '@testing-library/react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { RootNavigator } from '../src/navigation/RootNavigator';

describe('RootNavigator', () => {
  test('shows the sign-in screen when no user is authenticated', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback(null);
      return () => {};
    });

    render(<RootNavigator />);

    expect(await screen.findByText('Sign in to Faith')).toBeTruthy();
  });

  test('shows the home screen when a user is authenticated', async () => {
    (onAuthStateChanged as jest.Mock).mockImplementation((_auth, callback) => {
      callback({ uid: 'alice' });
      return () => {};
    });

    render(<RootNavigator />);

    expect(await screen.findByText('Welcome to Faith')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- HomeScreen.test.tsx RootNavigator.test.tsx`
Expected: FAIL — `HomeScreen` doesn't yet import or render `SheepMascot`/`StreakCalendar`, so the two new tests can't find `sheep-mascot`/`streak-calendar`/the streak text; the other tests still pass unchanged (the new mocks are additive).

- [ ] **Step 3: Write minimal implementation**

Replace `app/src/screens/HomeScreen.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator, ScrollView } from 'react-native';
import { auth } from '../firebase/config';
import { fetchDailyVerseDoc } from '../firebase/dailyVerse';
import { markVerseViewed, saveJournalAnswers } from '../firebase/engagement';
import { fetchVerseText } from '../api/bibleApi';
import { scheduleDailyReminder } from '../notifications/dailyReminder';
import { getTodayDateString } from '../utils/date';
import { DEFAULT_TRANSLATION } from '../constants';
import { showAlert } from '../utils/alert';
import { fetchWellnessState } from '../firebase/userProfile';
import { recordEngagement } from '../wellness/recordEngagement';
import { DEFAULT_WELLNESS_STATE, WellnessState } from '../wellness/wellnessState';
import { fetchEngagedDatesInMonth } from '../firebase/engagementCalendar';
import { SheepMascot } from '../components/SheepMascot';
import { StreakCalendar } from '../components/StreakCalendar';

type Status = 'loading' | 'ready' | 'no-verse' | 'error';

export function HomeScreen() {
  const [verseText, setVerseText] = useState('');
  const [reference, setReference] = useState('');
  const [prompts, setPrompts] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('loading');
  const [wellness, setWellness] = useState<WellnessState>(DEFAULT_WELLNESS_STATE);
  const [engagedDates, setEngagedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    scheduleDailyReminder().catch(() => {});

    const uid = auth.currentUser?.uid;
    const date = getTodayDateString();
    const now = new Date();

    if (uid) {
      fetchWellnessState(uid).then(setWellness).catch(() => {});
      fetchEngagedDatesInMonth(uid, now.getFullYear(), now.getMonth() + 1)
        .then(setEngagedDates)
        .catch(() => {});
    }

    (async () => {
      try {
        const dailyVerse = await fetchDailyVerseDoc(date);
        if (!dailyVerse) {
          setStatus('no-verse');
          return;
        }
        setReference(dailyVerse.reference);
        setPrompts(dailyVerse.journalPrompts);

        const text = await fetchVerseText(dailyVerse.reference, DEFAULT_TRANSLATION);
        setVerseText(text);
        setStatus('ready');

        if (uid) {
          markVerseViewed(uid, date).catch(() => {});
          recordEngagement(uid, date).then(setWellness).catch(() => {});
        }
      } catch (error) {
        setStatus('error');
        showAlert('Could not load today’s verse', (error as Error).message);
      }
    })();
  }, []);

  const handleSaveReflections = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      return;
    }
    try {
      await saveJournalAnswers(uid, getTodayDateString(), answers);
    } catch (error) {
      showAlert('Could not save your reflections', (error as Error).message);
    }
  };

  if (status === 'loading') {
    return (
      <View>
        <Text>Welcome to Faith</Text>
        <ActivityIndicator />
      </View>
    );
  }

  const now = new Date();

  return (
    <ScrollView>
      <Text>Welcome to Faith</Text>

      {status === 'no-verse' && (
        <Text>Today's verse isn't available yet — check back soon.</Text>
      )}

      {status === 'error' && <Text>Something went wrong loading today's verse.</Text>}

      {status === 'ready' && (
        <>
          <Text>{reference}</Text>
          <Text>{verseText}</Text>
          {prompts.map((prompt, index) => (
            <View key={index}>
              <Text>{prompt}</Text>
              <TextInput
                testID={`journal-answer-${index}`}
                value={answers[String(index)] ?? ''}
                onChangeText={(text) =>
                  setAnswers((prev) => ({ ...prev, [String(index)]: text }))
                }
              />
            </View>
          ))}
          <Button title="Save reflections" onPress={handleSaveReflections} />
        </>
      )}

      <SheepMascot wellnessScore={wellness.wellnessScore} />
      <StreakCalendar
        year={now.getFullYear()}
        month={now.getMonth() + 1}
        engagedDates={engagedDates}
        currentStreak={wellness.currentStreak}
        longestStreak={wellness.longestStreak}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npm test`
Expected: PASS (all suites — every Phase 1/2 suite plus this phase's new ones)

- [ ] **Step 5: Run the typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: clean, no output

- [ ] **Step 6: Commit**

```bash
git add app/src/screens/HomeScreen.tsx app/__tests__/HomeScreen.test.tsx app/__tests__/RootNavigator.test.tsx
git commit -m "feat: show the sheep mascot and streak calendar on HomeScreen"
```

---

## What's Next

Phase 3 ends with a signed-in user seeing their streak/wellness state reflected in a placeholder sheep visual and a month-grid calendar, both computed from real engagement data written since Phase 2. Two follow-ups are explicitly not part of this phase: swapping `SheepMascot`'s placeholder visual for a real Rive/Lottie animation once an asset exists, and calendar month navigation (currently shows the current month only). Faith Journal (annotated verse entries) and Search/Favorites remain separate, unscheduled PRD features.
