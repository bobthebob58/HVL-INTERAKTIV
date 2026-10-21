/**
 * eslint.config — lint rules for every JavaScript and TypeScript file in the repository.
 *
 * Why: lint enforces part of the Documentation Standard automatically (TSDoc on exports, known
 *      TSDoc tags) and keeps style questions out of code review.
 * Spec: NFR-004
 * Collaborators: tsdoc.json (registers the @spec tag), tools/doc-lint (checks ESLint cannot do).
 * Tests: run by `npm run lint` in CI.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import i18next from 'eslint-plugin-i18next';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'docs/site/**',
      'tools/spec-site/vendor/**',
      'apps/server/src/generated/**',
      'apps/server/h5p/**',
      'apps/server/var/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tools/spec-site/spec-site.client.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    plugins: { jsdoc },
    rules: {
      // DOC-002: every exported function, class, interface and type alias carries TSDoc.
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, ClassDeclaration: true, MethodDefinition: false },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'],
        },
      ],
      'jsdoc/check-tag-names': ['error', { definedTags: ['spec'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/test/**/*.ts', '**/*.test.ts'],
    rules: { 'jsdoc/require-jsdoc': 'off' },
  },
  {
    // DOC-009: user-facing text in the web app comes from locale files, never literals.
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: { 'i18next/no-literal-string': ['error', { mode: 'jsx-only' }] },
  },
);
