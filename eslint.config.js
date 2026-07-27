const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');
const react = require('eslint-plugin-react');
const tseslint = require('typescript-eslint');

/**
 * ESLint 10 flat config.
 *
 * Formatting rules are deliberately absent — Prettier owns layout, and
 * `eslint-config-prettier` is applied last to switch off anything that would
 * disagree with it. What is left are correctness rules.
 */
module.exports = tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'dist/**',
      'coverage/**',
      'babel.config.js',
      'eslint.config.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest, __DEV__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react },
    // Pinned rather than 'detect': eslint-plugin-react's auto-detection uses an
    // ESLint context API that was removed in ESLint 10 and throws on load.
    settings: { react: { version: '19.2' } },
    rules: {
      ...react.configs.recommended.rules,

      // The JSX transform makes the React import unnecessary.
      'react/react-in-jsx-scope': 'off',
      // TypeScript props interfaces already do this job, and better.
      'react/prop-types': 'off',

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      eqeqeq: ['error', 'smart'],
      // Nothing logs to the console in a release build. `utils/logger.ts` is the
      // single sanctioned exception and gates every call behind `__DEV__`.
      'no-console': 'error',
      'prefer-const': 'error',
    },
  },

  {
    files: ['src/utils/logger.ts'],
    rules: { 'no-console': 'off' },
  },

  prettier
);
