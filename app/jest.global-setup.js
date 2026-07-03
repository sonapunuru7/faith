'use strict';

// Unlike `expo start`/`npx expo install` (which shell out through Expo CLI's
// own .env loader — see the "env: load .env" / "env: export ..." lines those
// commands print), plain `jest` never populates `process.env.EXPO_PUBLIC_*`.
//
// That gap is invisible until something actually validates one of those vars
// at render time: `useGoogleSignIn` (Task 5) passes
// `EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` to `expo-auth-session`'s Google
// provider, which throws if the platform-appropriate client ID field is
// `undefined` (jest-expo defaults `Platform.OS` to 'ios', so it requires
// `iosClientId`, falling back to `clientId`). `SignInScreen` — first rendered
// in tests by this task's `RootNavigator.test.tsx` — hits that throw unless
// the env var is at least defined (even as the empty string it is in this
// repo's `.env`), because `undefined` is what the invariant check rejects.
//
// Loading .env the same way Expo CLI does (via its own `@expo/env` package,
// already a transitive dependency) gives tests the same "defined, if empty"
// values the real app sees, with no new dependency and no change to any
// application code. `silent: true` keeps the loader's own console logging
// out of test output.
require('@expo/env').load(__dirname, { silent: true });

module.exports = async () => {};
