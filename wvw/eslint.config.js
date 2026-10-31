import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'voice-worker/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'src/__tests__/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
);
