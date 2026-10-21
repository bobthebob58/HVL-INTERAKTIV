/**
 * rationaleTags — tagged rationale comments (WHY:, SECURITY: …) must actually explain something.
 *
 * Why: `grep -rn "SECURITY:"` should give an evaluator a complete, meaningful tour of the
 *      security-relevant lines. An empty or one-word tag defeats that.
 * Spec: DOC-003
 * Invariants:
 *   - Every tag is followed by at least 15 characters of explanation (on the same line).
 *   - `UPSTREAM:` names a link; `SPEC-DEVIATION:` names a decision (D-xxx).
 * Collaborators: ../lib/repo.mjs; deviations are cross-checked by ./deviations.mjs (DOC-010).
 * Tests: tools/doc-lint/test/docLint.code.test.mjs
 */
import { read } from '../lib/repo.mjs';

export const id = 'DOC-003';
export const name = 'rationale-tags';

/** The tags defined by the Documentation Standard (DOC-003 table). */
export const TAGS = ['WHY', 'SECURITY', 'PRIVACY', 'A11Y', 'PEDAGOGY', 'UPSTREAM', 'SPEC-DEVIATION'];
const TAG_IN_COMMENT = new RegExp(`(?:\\/\\/|\\/\\*|^\\s*\\*|^\\s*#)\\s*(${TAGS.join('|')}):(.*)$`);

/**
 * Checks every tagged comment line in source files.
 * @param {{root: string, files: string[]}} ctx - Repository context.
 * @returns {{file: string, line: number, message: string}[]} Problems found.
 */
export function run({ root, files }) {
  const problems = [];
  for (const file of files) {
    read(root, file)
      .split('\n')
      .forEach((line, i) => {
        const m = TAG_IN_COMMENT.exec(line);
        if (!m) return;
        const [, tag, rest] = m;
        const text = rest.replace(/\*\/\s*$/, '').trim();
        const say = (message) => problems.push({ file, line: i + 1, message: `${tag}: ${message}` });
        if (text.length < 15) say('explanation is missing or too short (at least 15 characters)');
        if (tag === 'UPSTREAM' && !/https?:\/\//.test(text)) say('must link to the upstream issue');
        if (tag === 'SPEC-DEVIATION' && !/\bD-\d{3}\b/.test(text)) say('must name a decision (D-xxx)');
      });
  }
  return problems;
}
