/**
 * skeletonLibraryChecks — the checks of a pattern skeleton against the installed libraries: the main library is the
 * version the editor offers, each sub-content names a version its field offers, and every text, filled in nn, nb
 * and en, fits its field's length limit.
 *
 * Why: the editor offers each type in its newest installed minor version, and the sub-content policy refuses a
 *      version a field does not list (BranchingScenario 1.10 offers CoursePresentation 1.27, not 1.28). Lumi clips a
 *      text to its field's `maxLength` after escaping, so a long Bokmål text would be cut silently (D-084
 *      amendment). `content:check` finds all of these before a pattern reaches an author.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - Runs only with the installed libraries (`InstalledLibraryCatalogue`); without them the loader reports that
 *     instead (./patternContent.ts).
 *   - Lengths are counted as Lumi stores the text: token values escaped (`&` is five characters).
 *   - The sub-content policy compares the exact `H5P.Name x.y` string, and so does this check.
 * Collaborators: ./patternFolder.ts (the caller), ./skeletonFieldWalk.ts, ./installedLibraries.ts,
 *   ./patternTokenChecks.ts (`tokenValuesOf`), ../patterns/skeletonTokens.ts.
 * Tests: apps/server/test/learningDesign/content/patternLibraryChecks.test.ts
 */
import type { ContentProblem } from './contentProblem.js';
import { CONTENT_LANGUAGES } from './contentText.js';
import { problemAt, type ContentSource } from './contentSource.js';
import { parseLibraryName, type InstalledLibraryCatalogue } from './installedLibraries.js';
import { tokenValuesOf } from './patternTokenChecks.js';
import type { PatternFile } from './patternYaml.js';
import type { SkeletonFile } from './skeletonFile.js';
import { walkSkeletonFields, type SkeletonTextField } from './skeletonFieldWalk.js';
import { resolveTokens } from '../patterns/skeletonTokens.js';

const FETCH = 'run npm run h5p:fetch-libraries to install the pinned libraries';

function mainLibraryProblem(
  skeleton: ContentSource<SkeletonFile>,
  catalogue: InstalledLibraryCatalogue,
): ContentProblem | undefined {
  const { library } = skeleton.value;
  const name = parseLibraryName(library);
  if (!name) return undefined;
  const [newest] = catalogue.versionsOf(name.machineName);
  if (!newest)
    return problemAt(
      skeleton,
      ['library'],
      `names ${library}, but no version of ${name.machineName} is ` + `installed (${FETCH})`,
    );
  if (newest.major === name.major && newest.minor === name.minor) return undefined;
  const offered = `${name.machineName} ${newest.major}.${newest.minor}`;
  return problemAt(
    skeleton,
    ['library'],
    `names ${library}, but the editor offers ${offered}, the newest ` + `installed version; name ${offered}`,
  );
}

function lengthProblem(
  skeleton: ContentSource<SkeletonFile>,
  field: SkeletonTextField,
  texts: PatternFile['texts'],
): ContentProblem | undefined {
  const { maxLength } = field;
  if (maxLength === undefined) return undefined;
  const tooLong = CONTENT_LANGUAGES.map((language) => ({
    language,
    length: resolveTokens(field.text, tokenValuesOf(texts, language)).length,
  })).filter(({ length }) => length > maxLength);
  if (tooLong.length === 0) return undefined;
  const where = tooLong.map(({ language, length }) => `${length} characters in ${language}`).join(', ');
  return problemAt(
    skeleton,
    field.path,
    `is too long once filled in (${where}, with & < > counted as H5P ` +
      `stores them); this field allows at most ${maxLength}, and H5P would cut the rest`,
  );
}

/**
 * Checks one skeleton against the installed libraries.
 * @param skeleton - The loaded skeleton.
 * @param texts - The pattern's texts.
 * @param catalogue - The installed libraries.
 * @returns Every problem, each naming the skeleton file and the key.
 * @spec PED-010
 */
export function skeletonLibraryProblems(
  skeleton: ContentSource<SkeletonFile>,
  texts: PatternFile['texts'],
  catalogue: InstalledLibraryCatalogue,
): ContentProblem[] {
  const main = mainLibraryProblem(skeleton, catalogue);
  if (main) return [main];
  const semantics = catalogue.semanticsOf(skeleton.value.library);
  if (!semantics)
    return [
      problemAt(
        skeleton,
        ['library'],
        `has no readable semantics.json in the installed libraries (${FETCH})`,
      ),
    ];
  const fields = walkSkeletonFields(skeleton.value.params, semantics, catalogue);
  const problems: ContentProblem[] = [];
  for (const use of fields.libraries) {
    if (!use.offered.includes(use.library)) {
      const offered = use.offered.length > 0 ? use.offered.join(', ') : 'nothing';
      problems.push(
        problemAt(
          skeleton,
          use.path,
          `names ${use.library}, which this field does not offer; ` + `it offers ${offered}`,
        ),
      );
    } else if (!catalogue.semanticsOf(use.library)) {
      problems.push(problemAt(skeleton, use.path, `names ${use.library}, which is not installed (${FETCH})`));
    }
  }
  for (const field of fields.texts) {
    const problem = lengthProblem(skeleton, field, texts);
    if (problem) problems.push(problem);
  }
  return problems;
}
