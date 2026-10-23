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
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import globals from 'globals';

/** H5P-006, D-035, D-036: imports the server never uses. */
const SERVER_IMPORT_BANS = {
  paths: [
    {
      name: '@lumieducation/h5p-server',
      importNames: ['LaissezFairePermissionSystem'],
      message: 'Use HvlPermissionSystem (H5P-006).',
    },
    {
      name: 'ltijs',
      importNames: ['RedisCacheManager', 'ExpressHttpHandler', 'MongoLegacyDatabaseManager'],
      message: 'D-050: ltijs runs on our router, our node-redis cache and PrismaLtiDatabaseManager.',
    },
  ],
  patterns: [
    {
      group: ['@lumieducation/h5p-express', '@lumieducation/h5p-express/*'],
      message: 'Removed by D-035; the routes live in apps/server/src/http.',
    },
  ],
};

/** D-073, UD-020: modules that do I/O, which the pure validator under src/validation never imports. */
const VALIDATOR_IO_BANS = [
  {
    group: [
      'fs',
      'fs/*',
      'node:fs',
      'node:fs/*',
      'http',
      'https',
      'net',
      'dns',
      'child_process',
      'worker_threads',
    ],
    message: 'D-073: the validator is pure; read files and services outside src/validation.',
  },
  {
    group: ['node:http', 'node:https', 'node:net', 'node:dns', 'node:child_process', 'node:worker_threads'],
    message: 'D-073: the validator is pure; read files and services outside src/validation.',
  },
  {
    group: ['**/infra/*', '@prisma/*', 'redis', '@aws-sdk/*', 'express', 'ltijs', 'yaml'],
    message: 'D-073: the validator is pure; configuration is passed in as `context`.',
  },
];

const LAISSEZ_FAIRE = {
  selector: "Identifier[name='LaissezFairePermissionSystem']",
  message: 'Use HvlPermissionSystem (H5P-006).',
};

/** UD-001, D-072: colours come only from packages/design-tokens; no colour literal and no style attribute. */
const COLOUR_BANS = [
  {
    selector:
      'Literal[value=/(?:^|[\\s:,(])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/]',
    message: 'UD-001: use a design token, not a colour literal.',
  },
  {
    selector:
      'TemplateElement[value.raw=/(?:^|[\\s:,(])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\\(/]',
    message: 'UD-001: use a design token, not a colour literal.',
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: 'D-072: style with token classes, never the style attribute (it also breaks the nonce policy).',
  },
];

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
      'apps/web/.next/**',
      'apps/web/next-env.d.ts',
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
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.{ts,tsx}'] })),
  {
    files: ['**/*.{ts,tsx}'],
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
    files: ['**/test/**/*.{ts,tsx,mjs}', '**/*.test.{ts,tsx,mjs}'],
    rules: { 'jsdoc/require-jsdoc': 'off', 'jsdoc/require-param': 'off' },
  },
  {
    // H5P-006, D-035, D-036: Lumi's allow-everything permission system and the Express 4 routers of
    // h5p-express never enter the server; createH5pRuntime also refuses any other permission system at runtime.
    files: ['apps/server/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', SERVER_IMPORT_BANS],
      'no-restricted-syntax': ['error', LAISSEZ_FAIRE],
    },
  },
  {
    // D-073: the validator stays pure, so it can run on save, on publish and in tests.
    files: ['apps/server/src/validation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { ...SERVER_IMPORT_BANS, patterns: [...SERVER_IMPORT_BANS.patterns, ...VALIDATOR_IO_BANS] },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'D-073: the validator is pure (no I/O).' },
        { name: 'process', message: 'D-073: configuration is passed in as `context`.' },
      ],
    },
  },
  {
    // UD-001, D-072: no colour literal in application code; the tokens package is the one place for them.
    files: ['apps/*/src/**/*.{ts,tsx,js,mjs}', 'packages/*/src/**/*.{ts,tsx,js,mjs}'],
    ignores: ['packages/design-tokens/**'],
    rules: { 'no-restricted-syntax': ['error', ...COLOUR_BANS] },
  },
  {
    // The server's sources need both bans; a later block replaces a rule's options, so they are joined here.
    files: ['apps/server/src/**/*.{ts,js}'],
    rules: { 'no-restricted-syntax': ['error', LAISSEZ_FAIRE, ...COLOUR_BANS] },
  },
  {
    // UD-003: the H5P theme's static script runs as a classic script inside H5P documents (no modules there).
    files: ['packages/hvl-h5p-theme/src/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    // SECURITY: LTI-003 / D-048: the ltik lives only in page memory, never in browser storage or cookies.
    files: ['apps/server/src/lti/pages/client/*.js', 'apps/server/src/h5p/render/client/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: 'LTI-003: keep the ltik in memory only.' },
        { name: 'sessionStorage', message: 'LTI-003: keep the ltik in memory only.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'LTI-003: keep the ltik in memory only.' },
        { object: 'window', property: 'sessionStorage', message: 'LTI-003: keep the ltik in memory only.' },
        { object: 'document', property: 'cookie', message: 'LTI-003: keep the ltik in memory only.' },
      ],
    },
  },
  {
    // D-068: the web app's React and Next.js rules; Next.js finds the app through `rootDir`.
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, '@next/next': nextPlugin },
    settings: { next: { rootDir: 'apps/web/' } },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.flat['recommended-latest'].rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  {
    // DOC-009: user-facing text in the web app comes from locale files, never literals.
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { i18next },
    rules: { 'i18next/no-literal-string': ['error', { mode: 'jsx-only' }] },
  },
);
