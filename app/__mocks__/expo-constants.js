'use strict';

// Manual mock, auto-applied by Jest for the `expo-constants` node module
// (files in `__mocks__` adjacent to `node_modules` are used automatically,
// no `jest.mock('expo-constants')` call needed — see
// https://jestjs.io/docs/manual-mocks#mocking-node-modules).
//
// Why this exists: `Constants.expoConfig` is populated at runtime by Expo's
// native module / Metro build pipeline from `app.json`. Neither exists under
// plain `jest`, so the real module's `expoConfig` is always `{}` in tests
// (verified directly: `Constants.expoConfig` logs as `{}`). That's invisible
// until something checks it: `expo-linking`'s `resolveScheme()` — reached via
// `expo-auth-session`'s Google provider, used by `useGoogleSignIn` (Task 5) —
// throws "expo-linking needs access to the expo-constants manifest" when
// `Object.keys(Constants.expoConfig ?? {}).length === 0`. Rendering
// `SignInScreen` (first done in tests by this task's `RootNavigator.test.tsx`)
// hits that throw.
//
// Fix: keep everything else from the real module, but back `expoConfig` with
// this project's actual `app.json` `expo` config (which already declares the
// `scheme` `expo-linking` needs), matching what a real build would embed.
// `executionEnvironment` also needs a value: without a native module, the
// real module leaves it `undefined`, which makes `expo-linking`'s
// `hasCustomScheme()` fall through to faking a scheme from
// `Constants.linkingUri` (itself `undefined` under Jest) and crash. This repo
// is a standard Expo app with native project directories once built, i.e.
// the "bare" execution environment, which is also the one `hasCustomScheme()`
// trusts immediately based on the declared `scheme` above.
const actual = jest.requireActual('expo-constants');
const { expo: expoConfig } = require('../app.json');

module.exports = {
  ...actual,
  default: {
    ...actual.default,
    expoConfig,
    executionEnvironment: actual.ExecutionEnvironment.Bare,
  },
  __esModule: true,
};
