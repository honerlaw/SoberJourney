// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // eslint-config-expo 57 turns on these React Compiler rules as errors.
    // They flag patterns that predate the SDK 57 upgrade (the compiler skips
    // those components, as it did before); warn until they are reworked.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]);
