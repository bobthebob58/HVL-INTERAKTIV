/**
 * mappeTemplateBench — small pedagogisk mappe templates for the loader tests: a minimal template that passes, and the
 * problems of the mappe fixture with its three templates replaced.
 *
 * Why: the loader's rules are tested one line at a time; a minimal template with every marker keeps each test's line
 *      numbers short and exact, and the fixture's criteria files keep the rest of the mappe valid (MAPPE-002).
 * Spec: MAPPE-002
 * Invariants:
 *   - Every copy is a temporary folder that `removeMappeFixtureCopies` removes after the test file.
 * Collaborators: ../../support/mappeFixture.ts.
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts,
 *   apps/server/test/learningDesign/content/mappeTemplateStructure.test.ts
 */
import type { ContentProblem } from '../../../src/learningDesign/content/contentProblem.js';
import { editedMappeFixture, loadFixtureMappe } from '../../support/mappeFixture.js';

/** A template that passes on its own: every marker once, in order, and one attachment. */
export const MIN = [
  '# Mappe',
  '{{lesarrettleiing}}',
  '{{del1_start}}',
  '## Del 1',
  '{{referansar}}',
  '{{del1_slutt}}',
  '{{vedlegg_start}}',
  '1. Brev',
  '{{vedlegg_slutt}}',
  '',
].join('\n');

/** Problems with the file name only. */
const shortProblems = (problems: readonly ContentProblem[]) =>
  problems.map(({ file, line, message }) => ({ file: file.split('/').pop(), line, message }));

/**
 * The problems of the fixture with these three templates.
 * @param nn - The Nynorsk template.
 * @param nb - The Bokmål template; MIN by default.
 * @param en - The English template; MIN by default.
 * @returns Each problem with the file name only.
 */
export function templateProblems(nn: string, nb: string = MIN, en: string = MIN) {
  const loaded = loadFixtureMappe(
    editedMappeFixture({
      'mappe/template.nn.md': nn,
      'mappe/template.nb.md': nb,
      'mappe/template.en.md': en,
    }),
  );
  if (loaded.ok) throw new Error('expected the templates to be refused');
  return shortProblems(loaded.problems);
}

/**
 * The problems of a template whose first line is `bad`, followed by MIN.
 * @param bad - The line under test.
 * @returns The problems.
 */
export const onLine1 = (bad: string) => templateProblems(`${bad}\n${MIN}`);
