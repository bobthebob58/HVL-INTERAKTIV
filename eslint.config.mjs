/**
 * eslint.config — lint rules for every JavaScript and TypeScript file in the repository.
 *
 * Why: lint enforces part of the Documentation Standard automatically (TSDoc on exports, known
 *      TSDoc tags) and keeps style questions out of code review.
 * Spec: NFR-004
 * Collaborators: tsdoc.json (declares @spec for TSDoc-aware tools such as editors; ESLint gets the same
 *   tag through `definedTags` below), tools/doc-lint (checks ESLint cannot do).
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
      'docs/api/**',
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
      // DOC-002: exported functions name every parameter. Class methods that implement a documented
      // interface (e.g. Lumi's IContentStorage) rely on that interface's documentation.
      'jsdoc/require-param': [
        'error',
        {
          checkDestructured: false,
          contexts: [
            'ExportNamedDeclaration > FunctionDeclaration',
            'ExportDefaultDeclaration > FunctionDeclaration',
          ],
        },
      ],
      'jsdoc/check-tag-names': ['error', { definedTags: ['spec'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/test/**/*.{ts,mjs}', '**/*.test.{ts,mjs}'],
    rules: { 'jsdoc/require-jsdoc': 'off', 'jsdoc/require-param': 'off' },
  },
  {
    // H5P-006, D-035, D-036: Lumi's allow-everything permission system and the Express 4 routers of
    // h5p-express never enter the server; createH5pRuntime also refuses any other permission system at runtime.
    files: ['apps/server/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lumieducation/h5p-server',
              importNames: ['LaissezFairePermissionSystem'],
              message: 'Use HvlPermissionSystem (H5P-006).',
            },
          ],
          patterns: [
            {
              group: ['@lumieducation/h5p-express', '@lumieducation/h5p-express/*'],
              message: 'Removed by D-035; the routes live in apps/server/src/http.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "Identifier[name='LaissezFairePermissionSystem']",
          message: 'Use HvlPermissionSystem (H5P-006).',
        },
      ],
    },
  },
  {
    // DOC-009: user-facing text in the web app comes from locale files, never literals.
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: { 'i18next/no-literal-string': ['error', { mode: 'jsx-only' }] },
  },
);
