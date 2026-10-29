/**
 * mappeTemplateContent — loads the three pedagogisk mappe templates (`content/mappe/template.{nn,nb,en}.md`) into
 * segments the renderer fills, after every check: cleaning, markers, tags, value places and parity.
 *
 * Why: the portfolio's headings and fixed guidance come from files ALU edits (MAPPE-002, D-094); the server checks
 *      them at start-up so a mistake stops the start with its file and line instead of reaching a teacher's export.
 * Spec: MAPPE-002
 * Invariants:
 *   - A template is returned only when all three languages load without a problem, so the renderer never meets a
 *     tag it does not know or a template whose markers are missing.
 *   - Parity is checked only when every file is fine on its own, so one mistake is reported once.
 *   - Every problem names the file and, where it has one, the line (`ContentProblem`; Markdown has no key path).
 * Collaborators: ./mappeContent.ts (the caller), ./mappeTemplateSource.ts, ./mappeTemplateSegments.ts,
 *   ./mappeTemplateTags.ts, ./mappeTemplateParity.ts.
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts,
 *   apps/server/test/learningDesign/content/mappeTemplateStructure.test.ts
 */
import type { Locale } from '../../i18n/translate.js';
import type { MappeMarker } from '../mappe/mappeVariables.js';
import type { ContentProblem } from './contentProblem.js';
import {
  templateHeadings,
  templateParityProblems,
  type MappeTemplateOutline,
} from './mappeTemplateParity.js';
import { cutAtMarkers, markerProblems, type MappeTemplateSegment } from './mappeTemplateSegments.js';
import { cleanMappeTemplate } from './mappeTemplateSource.js';
import { checkMappeTemplateTags } from './mappeTemplateTags.js';

/** One language's template, ready to render. */
export interface MappeTemplate {
  /** The text segments and the markers, in order. */
  readonly segments: readonly MappeTemplateSegment[];
}

/** One template file that was read. */
export interface ReadMappeTemplate {
  readonly language: Locale;
  readonly file: string;
  readonly source: string;
}

/** The result of checking one file on its own. */
interface CheckedTemplate {
  readonly language: Locale;
  readonly template: MappeTemplate;
  readonly outline: MappeTemplateOutline;
  readonly problems: readonly ContentProblem[];
}

function checkTemplate(read: ReadMappeTemplate): CheckedTemplate {
  const cleaned = cleanMappeTemplate(read.source);
  const segments = cutAtMarkers(cleaned.text);
  const tags = checkMappeTemplateTags(cleaned.text, segments);
  const local = [...cleaned.problems, ...markerProblems(segments), ...tags.problems];
  const problems = local.map((problem) => ({ file: read.file, ...problem }));
  if (problems.length === 0 && cleaned.text.trim() === '') {
    problems.push({
      file: read.file,
      message: 'is empty; write the template, or remove all six mappe files',
    });
  }
  const markers = segments.flatMap((segment) =>
    segment.kind === 'marker' ? [{ name: segment.marker as MappeMarker, line: segment.line }] : [],
  );
  const outline = { file: read.file, markers, headings: templateHeadings(cleaned.text), ...tags.outline };
  return { language: read.language, template: { segments }, outline, problems };
}

/**
 * Checks the three templates, each on its own and then against the Nynorsk one.
 * @param files - The read templates, in the order nn, nb, en.
 * @returns The templates by language, or every problem.
 * @spec MAPPE-002
 */
export function loadMappeTemplates(
  files: readonly ReadMappeTemplate[],
):
  | { readonly ok: true; readonly templates: Readonly<Record<Locale, MappeTemplate>> }
  | { readonly ok: false; readonly problems: readonly ContentProblem[] } {
  const checked = files.map(checkTemplate);
  const problems = checked.flatMap((template) => template.problems);
  const [reference, ...others] = checked;
  if (problems.length > 0 || !reference) return { ok: false, problems };
  const parity = templateParityProblems(
    reference.outline,
    others.map((other) => other.outline),
  );
  if (parity.length > 0) return { ok: false, problems: parity };
  const templates = Object.fromEntries(checked.map(({ language, template }) => [language, template]));
  // WHY: the caller passes exactly nn, nb and en, so every key is set.
  return { ok: true, templates: templates as Record<Locale, MappeTemplate> };
}
