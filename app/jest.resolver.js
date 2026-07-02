'use strict';

// React Native's jest test environment restricts customExportConditions to
// ['require', 'react-native'] (see @react-native/jest-preset/jest/react-native-env.js).
// Firebase's package.json "exports" maps only key their CJS build under "node"/
// "browser" conditions, neither of which is present in that list, so resolution
// falls through to the "default" condition, which points at an ESM build Jest
// can't execute (jest-expo's babel transform only covers .js/.jsx/.ts/.tsx, not
// the .mjs/esm files Firebase ships). Stripping "exports"/"module"/"browser" for
// firebase/@firebase packages makes resolution fall back to their CommonJS
// "main" entry point instead, which Jest can run directly.
//
// This mirrors the same packageFilter technique @react-native/jest-preset
// already uses (deleting "exports" for the "react-native" package itself for
// backwards compatibility), just extended to cover the Firebase packages
// pulled in by @firebase/rules-unit-testing.

module.exports = (path, options) => {
  const originalPackageFilter = options.packageFilter;

  return options.defaultResolver(path, {
    ...options,
    packageFilter: (pkg) => {
      const filteredPkg = originalPackageFilter ? originalPackageFilter(pkg) : pkg;

      if (filteredPkg.name === 'react-native') {
        delete filteredPkg.exports;
      }

      if (
        filteredPkg.name === 'firebase' ||
        filteredPkg.name?.startsWith('firebase/') ||
        filteredPkg.name?.startsWith('@firebase/')
      ) {
        delete filteredPkg.exports;
        delete filteredPkg.module;
        delete filteredPkg.browser;
      }

      return filteredPkg;
    },
  });
};
