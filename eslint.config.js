import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/', 'data/'] },
  js.configs.recommended,
  {
    files: ['downloader/**/*.mjs', 'extension/test/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['extension/src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, chrome: 'readonly' } },
  },
];
