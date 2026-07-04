# Faith App — Phase 2: Verse of the Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `HomeScreen`'s placeholder with the real Verse of the Day experience — fetch today's verse and journal prompts, render the verse text via the Bible API client, save engagement/journal answers to Firestore, and schedule a daily local reminder notification.

**Architecture:** `HomeScreen` orchestrates three small, independently-testable Firebase/notification helper modules (`dailyVerse.ts`, `engagement.ts`, `dailyReminder.ts`) plus the Bible API client already built in Phase 1. No new Firestore security rules are needed — Phase 1's rules already permit a signed-in user to read `dailyVerses/{date}` and read/write their own `users/{uid}/engagement/{date}`.

**Tech Stack:** Same as Phase 1 (Expo/TypeScript, Firebase JS SDK, Jest + `@testing-library/react-native`), plus `expo-notifications` for on-device local scheduling — no push backend or EAS project needed.

**Out of scope for this phase (deferred):** The Sheep mascot/wellness score, Streak Calendar, Faith Journal entries (annotated verses), and Search/Favorites are separate PRD features not covered here — this phase only covers Verse of the Day + journal prompts + the daily reminder notification, per the Phase 1 plan's "What's Next".

## Global Constraints

- All constraints from the Phase 1 plan still apply (TypeScript throughout, `EXPO_PUBLIC_*` env var prefix, Jest with `jest-expo` + `@testing-library/react-native`, credentials never committed).
- Bible translation for v1 is a fixed default (`KJV`) via a single shared constant — no settings/translation-switching UI exists yet; that's deferred to a later phase.
- `Engagement.completedAt` is stored as a plain epoch-millis `number` (matching the existing `Engagement.completedAt: number | null` type in `src/types/models.ts`), not a Firestore server timestamp.
- Notifications are local-only (`expo-notifications` scheduling APIs); no push token, no EAS project, no server-triggered notification is introduced.
- If notification permission is denied, the app must not crash or block Verse of the Day usage — scheduling is best-effort.
- No new Firestore security rules are needed for this phase; do not modify `firestore.rules`.

## Prerequisites (do once, before Task 1)

1. Add the api.bible key created in Phase 1's Prerequisites (step 3) to `app/.env`:
   ```
   EXPO_PUBLIC_BIBLE_API_KEY=
   ```
2. There is no admin content pipeline in v1 — daily verses are curated manually. In the [Firebase console](https://console.firebase.google.com) → Firestore → Data, create a `dailyVerses` collection with a document whose ID is **today's date** in `YYYY-MM-DD` form (e.g. `2026-07-04`), with fields:
   - `reference` (string), e.g. `"Philippians 4:6-7"`
   - `journalPrompts` (array of strings), e.g. `["Where did you see this today?"]`

   Without this document, Task 5's manual test will correctly show the "not available yet" fallback instead of real verse content — that's expected, not a bug, but you'll want real content to see the full flow.

---

### Task 1: Shared constants and date utility

**Files:**
- Create: `app/src/constants.ts`
- Create: `app/src/utils/date.ts`
- Test: `app/__tests__/date.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `DEFAULT_TRANSLATION`, `DEFAULT_REMINDER_HOUR`, `DEFAULT_REMINDER_MINUTE` from `app/src/constants.ts`; `getTodayDateString(date?: Date): string` from `app/src/utils/date.ts` — later tasks import both.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/date.test.ts`:
```typescript
import { getTodayDateString } from '../src/utils/date';

describe('getTodayDateString', () => {
  test('formats a given date as YYYY-MM-DD using local date parts', () => {
    const date = new Date(2026, 6, 4); // July 4, 2026 (month is 0-indexed)
    expect(getTodayDateString(date)).toBe('2026-07-04');
  });

  test('zero-pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // January 5, 2026
    expect(getTodayDateString(date)).toBe('2026-01-05');
  });

  test('defaults to the current date when no argument is given', () => {
    const now = new Date();
    const expected = getTodayDateString(now);
    expect(getTodayDateString()).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- date.test.ts`
Expected: FAIL — cannot find module `../src/utils/date`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/constants.ts`:
```typescript
export const DEFAULT_TRANSLATION = 'KJV';
export const DEFAULT_REMINDER_HOUR = 8;
export const DEFAULT_REMINDER_MINUTE = 0;
```

Create `app/src/utils/date.ts`:
```typescript
export function getTodayDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- date.test.ts`
Expected: PASS (3 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/constants.ts app/src/utils/date.ts app/__tests__/date.test.ts
git commit -m "feat: add shared constants and a local date-string utility"
```

---

### Task 2: Daily verse Firestore fetch helper

**Files:**
- Create: `app/src/firebase/dailyVerse.ts`
- Test: `app/__tests__/dailyVerse.test.ts`

**Interfaces:**
- Consumes: `db` from `app/src/firebase/config.ts` (Phase 1 Task 2); `DailyVerse` type from `app/src/types/models.ts` (Phase 1 Task 2)
- Produces: `fetchDailyVerseDoc(date: string): Promise<DailyVerse | null>` from `app/src/firebase/dailyVerse.ts` — Task 5's `HomeScreen` calls this directly.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/dailyVerse.test.ts`:
```typescript
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  getDoc: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { doc, getDoc } from 'firebase/firestore';
import { fetchDailyVerseDoc } from '../src/firebase/dailyVerse';

describe('fetchDailyVerseDoc', () => {
  test('returns the daily verse when the document exists', async () => {
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => ({
        reference: 'Philippians 4:6-7',
        journalPrompts: ['Where did you see this today?'],
      }),
    });

    const result = await fetchDailyVerseDoc('2026-07-04');

    expect(doc).toHaveBeenCalledWith({}, 'dailyVerses', '2026-07-04');
    expect(result).toEqual({
      reference: 'Philippians 4:6-7',
      journalPrompts: ['Where did you see this today?'],
    });
  });

  test('returns null when no document exists for that date', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const result = await fetchDailyVerseDoc('2099-01-01');

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- dailyVerse.test.ts`
Expected: FAIL — cannot find module `../src/firebase/dailyVerse`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/firebase/dailyVerse.ts`:
```typescript
import { doc, getDoc } from 'firebase/firestore';
import { db } from './config';
import { DailyVerse } from '../types/models';

export async function fetchDailyVerseDoc(date: string): Promise<DailyVerse | null> {
  const snapshot = await getDoc(doc(db, 'dailyVerses', date));
  if (!snapshot.exists()) {
    return null;
  }
  return snapshot.data() as DailyVerse;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- dailyVerse.test.ts`
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/firebase/dailyVerse.ts app/__tests__/dailyVerse.test.ts
git commit -m "feat: add Firestore fetch helper for the daily verse document"
```

---

### Task 3: Engagement read/write helpers

**Files:**
- Create: `app/src/firebase/engagement.ts`
- Test: `app/__tests__/engagement.test.ts`

**Interfaces:**
- Consumes: `db` from `app/src/firebase/config.ts` (Phase 1 Task 2)
- Produces: `markVerseViewed(uid: string, date: string): Promise<void>` and `saveJournalAnswers(uid: string, date: string, journalAnswers: Record<string, string>): Promise<void>` from `app/src/firebase/engagement.ts` — Task 5's `HomeScreen` calls both directly.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/engagement.test.ts`:
```typescript
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...pathSegments) => ({ path: pathSegments.join('/') })),
  setDoc: jest.fn(),
}));

jest.mock('../src/firebase/config', () => ({ db: {} }));

import { doc, setDoc } from 'firebase/firestore';
import { markVerseViewed, saveJournalAnswers } from '../src/firebase/engagement';

describe('markVerseViewed', () => {
  test('merges viewedVerse and a numeric completedAt into the engagement doc', async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    await markVerseViewed('alice', '2026-07-04');

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice', 'engagement', '2026-07-04');
    const [, payload, options] = (setDoc as jest.Mock).mock.calls[0];
    expect(payload.viewedVerse).toBe(true);
    expect(typeof payload.completedAt).toBe('number');
    expect(options).toEqual({ merge: true });
  });
});

describe('saveJournalAnswers', () => {
  test('merges journalAnswers into the engagement doc', async () => {
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    await saveJournalAnswers('alice', '2026-07-04', { '0': 'Grateful for rest.' });

    expect(doc).toHaveBeenCalledWith({}, 'users', 'alice', 'engagement', '2026-07-04');
    expect(setDoc).toHaveBeenCalledWith(
      { path: 'users/alice/engagement/2026-07-04' },
      { journalAnswers: { '0': 'Grateful for rest.' } },
      { merge: true }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- engagement.test.ts`
Expected: FAIL — cannot find module `../src/firebase/engagement`

- [ ] **Step 3: Write minimal implementation**

Create `app/src/firebase/engagement.ts`:
```typescript
import { doc, setDoc } from 'firebase/firestore';
import { db } from './config';

export async function markVerseViewed(uid: string, date: string): Promise<void> {
  await setDoc(
    doc(db, 'users', uid, 'engagement', date),
    { viewedVerse: true, completedAt: Date.now() },
    { merge: true }
  );
}

export async function saveJournalAnswers(
  uid: string,
  date: string,
  journalAnswers: Record<string, string>
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'engagement', date), { journalAnswers }, { merge: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- engagement.test.ts`
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit**

```bash
git add app/src/firebase/engagement.ts app/__tests__/engagement.test.ts
git commit -m "feat: add Firestore read/write helpers for daily engagement"
```

---

### Task 4: Daily local reminder notification

**Files:**
- Create: `app/src/notifications/dailyReminder.ts`
- Test: `app/__tests__/dailyReminder.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_REMINDER_HOUR`, `DEFAULT_REMINDER_MINUTE` from `app/src/constants.ts` (Task 1)
- Produces: `scheduleDailyReminder(): Promise<void>` from `app/src/notifications/dailyReminder.ts` — Task 5's `HomeScreen` calls this once per mount.

- [ ] **Step 1: Install expo-notifications**

```bash
cd app && npx expo install expo-notifications
```

- [ ] **Step 2: Write the failing tests**

Create `app/__tests__/dailyReminder.test.ts`:
```typescript
jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

import * as Notifications from 'expo-notifications';
import { scheduleDailyReminder } from '../src/notifications/dailyReminder';

describe('scheduleDailyReminder', () => {
  beforeEach(() => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockReset();
    (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockReset();
    (Notifications.scheduleNotificationAsync as jest.Mock).mockReset();
  });

  test('schedules a daily 8:00am reminder when permission is granted', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });

    await scheduleDailyReminder();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'daily-verse-reminder'
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'daily-verse-reminder',
      content: { title: 'Faith', body: 'Your verse of the day is ready.' },
      trigger: { type: 'daily', hour: 8, minute: 0 },
    });
  });

  test('does not schedule anything when permission is denied', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });

    await scheduleDailyReminder();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npm test -- dailyReminder.test.ts`
Expected: FAIL — cannot find module `../src/notifications/dailyReminder`

- [ ] **Step 4: Write minimal implementation**

Create `app/src/notifications/dailyReminder.ts`:
```typescript
import * as Notifications from 'expo-notifications';
import { DEFAULT_REMINDER_HOUR, DEFAULT_REMINDER_MINUTE } from '../constants';

const REMINDER_IDENTIFIER = 'daily-verse-reminder';

export async function scheduleDailyReminder(): Promise<void> {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(REMINDER_IDENTIFIER);
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_IDENTIFIER,
    content: { title: 'Faith', body: 'Your verse of the day is ready.' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: DEFAULT_REMINDER_HOUR,
      minute: DEFAULT_REMINDER_MINUTE,
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npm test -- dailyReminder.test.ts`
Expected: PASS (2 tests passed)

- [ ] **Step 6: Commit**

```bash
git add app/src/notifications/dailyReminder.ts app/__tests__/dailyReminder.test.ts app/package.json app/package-lock.json
git commit -m "feat: schedule a daily local reminder notification"
```

---

### Task 5: HomeScreen — Verse of the Day + journal prompts

**Files:**
- Modify: `app/src/screens/HomeScreen.tsx`
- Modify: `app/__tests__/RootNavigator.test.tsx`
- Test: `app/__tests__/HomeScreen.test.tsx`

**Interfaces:**
- Consumes: `auth` from `app/src/firebase/config.ts` (Phase 1 Task 2); `fetchVerseText` from `app/src/api/bibleApi.ts` (Phase 1 Task 3); `showAlert` from `app/src/utils/alert.ts` (Phase 1 hardening fix); `getTodayDateString` (Task 1); `DEFAULT_TRANSLATION` (Task 1); `fetchDailyVerseDoc` (Task 2); `markVerseViewed`, `saveJournalAnswers` (Task 3); `scheduleDailyReminder` (Task 4)
- Produces: updated `HomeScreen` component — this is the last task in this phase, nothing downstream depends on new exports from it.

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/HomeScreen.test.tsx`:
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

import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { fetchDailyVerseDoc } from '../src/firebase/dailyVerse';
import { markVerseViewed, saveJournalAnswers } from '../src/firebase/engagement';
import { fetchVerseText } from '../src/api/bibleApi';
import { HomeScreen } from '../src/screens/HomeScreen';

describe('HomeScreen', () => {
  beforeEach(() => {
    (fetchDailyVerseDoc as jest.Mock).mockReset();
    (fetchVerseText as jest.Mock).mockReset();
    (markVerseViewed as jest.Mock).mockClear();
    (saveJournalAnswers as jest.Mock).mockClear();
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- HomeScreen.test.tsx`
Expected: FAIL — the current `HomeScreen` only renders static "Welcome to Faith" text, so none of the new assertions (verse text, prompts, testIDs) are found.

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

type Status = 'loading' | 'ready' | 'no-verse' | 'error';

export function HomeScreen() {
  const [verseText, setVerseText] = useState('');
  const [reference, setReference] = useState('');
  const [prompts, setPrompts] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    scheduleDailyReminder().catch(() => {});

    const uid = auth.currentUser?.uid;
    const date = getTodayDateString();

    (async () => {
      try {
        const dailyVerse = await fetchDailyVerseDoc(date);
        if (!dailyVerse) {
          setStatus('no-verse');
          return;
        }
        setReference(dailyVerse.reference);
        setPrompts(dailyVerse.journalPrompts);

        const text = await fetchVerseText(
          dailyVerse.reference,
          DEFAULT_TRANSLATION,
          process.env.EXPO_PUBLIC_BIBLE_API_KEY ?? ''
        );
        setVerseText(text);
        setStatus('ready');

        if (uid) {
          await markVerseViewed(uid, date);
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

  if (status === 'no-verse') {
    return (
      <View>
        <Text>Welcome to Faith</Text>
        <Text>Today's verse isn't available yet — check back soon.</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View>
        <Text>Welcome to Faith</Text>
        <Text>Something went wrong loading today's verse.</Text>
      </View>
    );
  }

  return (
    <ScrollView>
      <Text>Welcome to Faith</Text>
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
    </ScrollView>
  );
}
```

- [ ] **Step 4: Update RootNavigator's test mocks**

`RootNavigator.test.tsx`'s "shows the home screen" case now renders the real `HomeScreen` above, which needs its new dependencies mocked too. Replace `app/__tests__/RootNavigator.test.tsx`:
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
(`fetchDailyVerseDoc` resolves `null` here, so `HomeScreen` settles into its `no-verse` branch — which still renders the persistent "Welcome to Faith" heading the assertion checks for.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npm test`
Expected: PASS (all suites — App, RootNavigator, HomeScreen, and every Phase 1 suite)

- [ ] **Step 6: Commit**

```bash
git add app/src/screens/HomeScreen.tsx app/__tests__/HomeScreen.test.tsx app/__tests__/RootNavigator.test.tsx
git commit -m "feat: replace HomeScreen placeholder with Verse of the Day + journal prompts"
```

---

## What's Next

Phase 2 ends with a signed-in user seeing today's verse, answering journal prompts, and receiving a daily local reminder. Phase 3 will likely cover the Sheep mascot (wellness score + grace-period logic from PRD Section 8) and the Streak Calendar, both of which read from the `users/{uid}/engagement` subcollection this phase writes to. Faith Journal (annotated verse entries) and Search/Favorites remain separate, unscheduled PRD features.
