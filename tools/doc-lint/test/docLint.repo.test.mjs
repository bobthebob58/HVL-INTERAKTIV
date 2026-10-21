/**
 * Tests for the repository-level checks: READMEs, configuration, locales, deviations and content guides.
 *
 * Spec: DOC-005, DOC-008, DOC-009, DOC-010, DOC-014
 */
import { describe, it, expect, afterAll } from 'vitest';
import { flattenKeys } from '../checks/localeParity.mjs';
import { makeRepo, problems, removeTempRepos, comment, GOOD_HEADER } from './tempRepo.mjs';

afterAll(removeTempRepos);

const APP_README = ['Purpose', 'How to run', 'Folder structure', 'Key flows', 'Configuration', 'Implements']
  .map((s) => `## ${s}\n\ntext\n`)
  .join('\n');

describe('[DOC-005] READMEs', () => {
  it('[DOC-005] accepts apps with all six sections and tools with Purpose and How to run', () => {
    const root = makeRepo({
      'apps/server/README.md': `# Server\n\n${APP_README}`,
      'tools/w/README.md': '# w\n\n## Purpose\n\nx\n\n## How to run\n\nx\n',
    });
    expect(problems(root, 'package-readme')).toEqual([]);
  });

  it('[DOC-005] names the missing README and each missing section', () => {
    const root = makeRepo({
      'packages/design-tokens/tokens.json': '{}',
      'apps/server/README.md': '# Server\n\n## Purpose\n\n## How to run (locally)\n',
    });
    expect(problems(root, 'package-readme')).toEqual([
      'apps/server/README.md:1 README lacks a "## Folder structure" section',
      'apps/server/README.md:1 README lacks a "## Key flows" section',
      'apps/server/README.md:1 README lacks a "## Configuration" section',
      'apps/server/README.md:1 README lacks a "## Implements" section',
      'packages/design-tokens:1 missing README.md',
    ]);
  });
});

describe('[DOC-008] configuration is documented', () => {
  const env = `${GOOD_HEADER}export const schema = z.object({\n  DATABASE_URL: z.string(),\n  PORT: z.coerce.number(),\n});\n`;

  it('[DOC-008] accepts an .env.example that explains every schema variable', () => {
    const example = [
      '# Purpose: PostgreSQL connection string.',
      '# Secret: yes. Default: none.',
      'DATABASE_URL=postgresql://x',
      '',
      '# Purpose: HTTP port. Secret: no. Default: 3000.',
      'PORT=3000',
    ].join('\n');
    const root = makeRepo({ 'apps/server/src/config/env.ts': env, 'apps/server/.env.example': example });
    expect(problems(root, 'env-documented')).toEqual([]);
  });

  it('[DOC-008] reports undocumented, unexplained and unknown variables', () => {
    const example = 'DATABASE_URL=postgresql://x\n# Left over. Secret: no. Default: 1.\nLEGACY=1\n';
    const root = makeRepo({ 'apps/server/src/config/env.ts': env, 'apps/server/.env.example': example });
    expect(problems(root, 'env-documented')).toEqual([
      'apps/server/.env.example:1 DATABASE_URL has no explanatory comment above it',
      'apps/server/.env.example:3 LEGACY is not in env.ts',
      'apps/server/.env.example:1 PORT (from env.ts) is not documented here',
    ]);
  });

  it('[DOC-008] requires each comment to say whether the value is secret and what the default is', () => {
    const example =
      '# Purpose: connection string.\nDATABASE_URL=x\n# Purpose: port. Default: 3000.\nPORT=3000\n';
    const root = makeRepo({ 'apps/server/src/config/env.ts': env, 'apps/server/.env.example': example });
    expect(problems(root, 'env-documented')).toEqual([
      'apps/server/.env.example:2 DATABASE_URL comment lacks "Secret:"',
      'apps/server/.env.example:2 DATABASE_URL comment lacks "Default:"',
      'apps/server/.env.example:4 PORT comment lacks "Secret:"',
    ]);
  });

  it('[DOC-008] requires the .env.example file once a schema exists', () => {
    const root = makeRepo({ 'apps/server/src/config/env.ts': env });
    expect(problems(root, 'env-documented')).toEqual([
      'apps/server/.env.example:1 missing; it must document every variable in env.ts',
    ]);
  });
});

describe('[DOC-009] locale parity', () => {
  it('[DOC-009] flattens nested keys into sorted dotted paths', () => {
    expect(flattenKeys({ b: 'x', a: { d: 'y', c: 'z' } })).toEqual(['a.c', 'a.d', 'b']);
  });

  it('[DOC-009] accepts nn, nb and en files with identical keys', () => {
    const msg = JSON.stringify({ boot: { ready: 'x' } });
    const root = makeRepo({
      'apps/server/src/i18n/locales/nn.json': msg,
      'apps/server/src/i18n/locales/nb.json': msg,
      'apps/server/src/i18n/locales/en.json': msg,
    });
    expect(problems(root, 'locale-parity')).toEqual([]);
  });

  it('[DOC-009] reports missing files, missing keys and extra keys against nn', () => {
    const root = makeRepo({
      'apps/server/src/i18n/locales/nn.json': JSON.stringify({ a: 'x', b: 'y' }),
      'apps/server/src/i18n/locales/nb.json': JSON.stringify({ a: 'x', c: 'z' }),
    });
    expect(problems(root, 'locale-parity')).toEqual([
      'apps/server/src/i18n/locales/en.json:1 missing en locale file',
      'apps/server/src/i18n/locales/nb.json:1 missing key b',
      'apps/server/src/i18n/locales/nb.json:1 extra key c (not in nn.json)',
    ]);
  });
});

describe('[DOC-010] deviations point to decisions', () => {
  it('[DOC-010] accepts a deviation that names an existing decision', () => {
    const root = makeRepo({
      'tools/w/w.mjs': GOOD_HEADER + comment('SPEC-DEVIATION', 'D-001 explains why we differ here.'),
    });
    expect(problems(root, 'deviations')).toEqual([]);
  });

  it('[DOC-010] rejects a deviation whose decision is missing', () => {
    const root = makeRepo({
      'tools/w/w.mjs': GOOD_HEADER + comment('SPEC-DEVIATION', 'D-404 explains why we differ here.'),
    });
    expect(problems(root, 'deviations')).toEqual([
      'tools/w/w.mjs:8 SPEC-DEVIATION names D-404, which is not in docs/DECISIONS.md',
    ]);
  });
});

describe('[DOC-014] content guides', () => {
  it('[DOC-014] passes when there is no content folder yet', () => {
    expect(problems(makeRepo({}), 'content-guides')).toEqual([]);
  });

  it('[DOC-014] requires a README in content/ and in each of its folders', () => {
    const root = makeRepo({
      'content/README.md': '# Content\n',
      'content/patterns/flipped.yaml': 'id: flipped\n',
      'content/phases/README.md': '# Phases\n',
    });
    expect(problems(root, 'content-guides')).toEqual([
      'content/patterns:1 missing README.md for the people who edit this content',
    ]);
  });
});
