import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Date.now() in sort/filter during render is a common pattern; not a real purity concern
      'react-hooks/purity': 'off',
      // setState in effects for conditional early-return and one-shot animations is legitimate
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  eslintConfigPrettier,
  {
    ignores: ['dist/', 'node_modules/', 'functions/'],
  },
);
