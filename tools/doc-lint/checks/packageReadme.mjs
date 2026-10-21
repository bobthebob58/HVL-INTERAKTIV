/**
 * packageReadme — every app, package and tool has a README with the sections reviewers rely on.
 *
 * Why: a reviewer starts at a folder's README. Apps and packages need the six sections of DOC-005;
 *      tools are smaller and need at least a purpose and run instructions.
 * Spec: DOC-005
 * Invariants: section names are matched case-insensitively against `##` headings.
 * Collaborators: ../lib/repo.mjs.
 * Tests: tools/doc-lint/test/docLint.repo.test.mjs
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { read } from '../lib/repo.mjs';

export const id = 'DOC-005';
export const name = 'package-readme';

/** Section headings required in app and package READMEs (DOC-005, in order of the standard). */
export const APP_SECTIONS = [
  'Purpose',
  'How to run',
  'Folder structure',
  'Key flows',
  'Configuration',
  'Implements',
];
/** Section headings required in tool READMEs. */
export const TOOL_SECTIONS = ['Purpose', 'How to run'];

const childDirs = (root, dir) =>
  existsSync(join(root, dir))
    ? readdirSync(join(root, dir)).filter(
        (d) => statSync(join(root, dir, d)).isDirectory() && d !== 'node_modules',
      )
    : [];

/**
 * Checks README presence and required sections.
 * @param {{root: string}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root }) {
  const problems = [];
  const targets = [
    ...['apps', 'packages'].flatMap((d) => childDirs(root, d).map((c) => [`${d}/${c}`, APP_SECTIONS])),
    ...childDirs(root, 'tools').map((c) => [`tools/${c}`, TOOL_SECTIONS]),
  ];
  for (const [dir, sections] of targets) {
    const file = `${dir}/README.md`;
    if (!existsSync(join(root, file))) {
      problems.push({ file: dir, line: 1, message: 'missing README.md' });
      continue;
    }
    const headings = [...read(root, file).matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].toLowerCase());
    for (const s of sections) {
      if (!headings.some((h) => h.includes(s.toLowerCase()))) {
        problems.push({ file, line: 1, message: `README lacks a "## ${s}" section` });
      }
    }
  }
  return problems;
}
