/**
 * mappeContent — the pedagogisk mappe's part of the studio content: loads `content/mappe/template.{nn,nb,en}.md` and
 * `content/mappe/criteria.{nn,nb,en}.yaml`, checked and merged (D-094).
 *
 * Why: the portfolio's headings and criteria live in files ALU edits without code (MAPPE-002, D-082).
 *      `loadStudioContent` calls this loader, and the mappe renderer (../mappe/) reads only what it returns.
 * Spec: MAPPE-002
 * Invariants:
 *   - The mappe is optional until it is written: all six files absent is "no portfolio yet" (`portfolio` undefined;
 *     the mappe routes answer `hvl:mappe-not-ready`). One to five present is a problem naming each missing file.
 *   - When present: the templates pass ./mappeTemplateContent.ts (comments and front matter removed, the tag
 *     allowlist, the markers, parity), and the criteria ./mappeCriteria.ts (strict schema, the default set, parity).
 *   - Every problem names the file and the line or key (`ContentProblem`).
 *   - Its part of the `npm run content:check` summary comes from `describeMappeContent` here.
 * Collaborators: ./loadStudioContent.ts (calls it), ./runContentCheck.ts (the summary), ./studioContentContext.ts,
 *   ./mappeTemplateSource.ts, ./mappeTemplateContent.ts, ./mappeCriteria.ts, ../mappe/ (the renderer).
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts,
 *   apps/server/test/learningDesign/content/mappeTemplateStructure.test.ts,
 *   apps/server/test/learningDesign/content/mappeCriteria.test.ts,
 *   apps/server/test/learningDesign/content/loadStudioContent.test.ts
 */
import { existsSync } from 'node:fs';
import type { Locale } from '../../i18n/translate.js';
import { contentDisplayPath, type ContentProblem } from './contentProblem.js';
import { CONTENT_LANGUAGES } from './contentText.js';
import { loadMappeCriteria, mappeCriteriaFileOf, type MappeCriteriaSet } from './mappeCriteria.js';
import { loadMappeTemplates, type MappeTemplate, type ReadMappeTemplate } from './mappeTemplateContent.js';
import { mappeTemplateFileOf, readMappeTemplateFile } from './mappeTemplateSource.js';
import { studioContentFile, type StudioContentContext } from './studioContentContext.js';
import { contentLoadFailed, type ContentLoadResult } from './yamlContentFile.js';

export type { MappeCriteriaSet, MappeCriterion } from './mappeCriteria.js';
export type { MappeTemplate } from './mappeTemplateContent.js';

/** The portfolio's template and criteria, once the six files exist. */
export interface MappePortfolioContent {
  /** The template in each language. */
  readonly templates: Readonly<Record<Locale, MappeTemplate>>;
  /** The criteria sets in file order, each text in nn, nb and en. */
  readonly criteriaSets: readonly MappeCriteriaSet[];
}

/** The loaded portfolio content. */
export interface MappeContent {
  /** The template and criteria, or undefined while none of the six files exists (no portfolio yet). */
  readonly portfolio?: MappePortfolioContent;
}

/** The six files, relative to the content folder, in the order an editor writes them. */
export const MAPPE_FILES: readonly string[] = CONTENT_LANGUAGES.flatMap((language) => [
  mappeTemplateFileOf(language),
  mappeCriteriaFileOf(language),
]);

const missingProblems = (context: StudioContentContext, missing: readonly string[]): ContentProblem[] =>
  missing.map((file) => ({
    file: contentDisplayPath(studioContentFile(context, file)),
    message:
      'is missing: the portfolio needs template.nn.md, template.nb.md, template.en.md and criteria.nn.yaml, ' +
      'criteria.nb.yaml, criteria.en.yaml (or none of them yet)',
  }));

/**
 * Loads and checks the portfolio template and criteria.
 * @param context - The content folder.
 * @returns The portfolio content (no portfolio while no file exists), or every problem in its files.
 * @spec MAPPE-002
 */
export function loadMappeContent(context: StudioContentContext): ContentLoadResult<MappeContent> {
  const present = MAPPE_FILES.filter((file) => existsSync(studioContentFile(context, file)));
  if (present.length === 0) return { ok: true, value: {} };
  const missing = MAPPE_FILES.filter((file) => !present.includes(file));
  if (missing.length > 0) return contentLoadFailed(missingProblems(context, missing));
  const problems: ContentProblem[] = [];
  const read: ReadMappeTemplate[] = [];
  for (const language of CONTENT_LANGUAGES) {
    const file = readMappeTemplateFile(context, language);
    if (file.state === 'read') read.push(file);
    else
      problems.push({
        file: file.file,
        message: `cannot read the file (${file.state === 'absent' ? 'ENOENT' : file.code})`,
      });
  }
  const templates = problems.length === 0 ? loadMappeTemplates(read) : undefined;
  const criteria = loadMappeCriteria(
    CONTENT_LANGUAGES.map((language) => ({
      language,
      path: studioContentFile(context, mappeCriteriaFileOf(language)),
    })),
  );
  if (templates && !templates.ok) problems.push(...templates.problems);
  if (!criteria.ok) problems.push(...criteria.problems);
  if (problems.length > 0 || !templates?.ok || !criteria.ok) return contentLoadFailed(problems);
  return { ok: true, value: { portfolio: { templates: templates.templates, criteriaSets: criteria.sets } } };
}

/**
 * This section's part of the one-line `npm run content:check` summary.
 * @param mappe - The loaded content of this section.
 * @returns e.g. `mappe template and 2 criteria sets in nn, nb and en`, or `no mappe yet` while no file exists.
 * @spec MAPPE-002
 */
export function describeMappeContent(mappe: MappeContent): string | undefined {
  const sets = mappe.portfolio?.criteriaSets.length;
  if (sets === undefined) return 'no mappe yet';
  return `mappe template and ${sets} criteria set${sets === 1 ? '' : 's'} in nn, nb and en`;
}
