/**
 * mappeTemplateParity — checks that the Bokmål and English pedagogisk mappe templates match the Nynorsk one: the
 * same markers in the same order, the same sections, the same values in each list and the same headings by level.
 *
 * Why: a teacher who exports in Bokmål or English must get the same portfolio with the same data as in Nynorsk
 *      (D-082: "the three templates have the same template variables"); a heading missing in one language would also
 *      leave its PDF outline different (MAPPE-004). Nynorsk is the reference, as it is for every text (D-009).
 * Spec: MAPPE-002, PROD-012
 * Invariants:
 *   - Problems are reported in the nb or en file, at the line of the first difference there (or that file's last
 *     heading, section or marker when it has fewer); nn is never blamed for a difference.
 *   - The values are compared as sets per list: a translation may put them in another order inside a sentence.
 * Collaborators: ./mappeTemplateContent.ts (the caller), ./mappeTemplateTags.ts (the outline).
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts,
 *   apps/server/test/learningDesign/content/mappeTemplateStructure.test.ts
 */
import type { ContentProblem } from './contentProblem.js';
import type { MappeTemplateTagOutline } from './mappeTemplateTags.js';

/** What one template's parity check reads. */
export interface MappeTemplateOutline extends MappeTemplateTagOutline {
  /** The file's display path. */
  readonly file: string;
  /** The markers in order, with their lines. */
  readonly markers: readonly { readonly name: string; readonly line: number }[];
  /** The ATX headings by level, with their lines. */
  readonly headings: readonly { readonly level: number; readonly line: number }[];
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/;

/**
 * The ATX headings of a cleaned template, outside code blocks.
 * @param text - The cleaned template.
 * @returns Each heading's level and line.
 * @spec MAPPE-002
 */
export function templateHeadings(text: string): { level: number; line: number }[] {
  const headings: { level: number; line: number }[] = [];
  let fence: string | undefined;
  text.split('\n').forEach((line, index) => {
    const marker = FENCE.exec(line)?.[1];
    if (marker && (fence === undefined || (marker[0] === fence[0] && marker.length >= fence.length))) {
      fence = fence === undefined ? marker : undefined;
      return;
    }
    const level = fence === undefined ? HEADING.exec(line)?.[1]?.length : undefined;
    if (level) headings.push({ level, line: index + 1 });
  });
  return headings;
}

const NN = 'template.nn.md';

function sequenceProblem<T extends { line: number }>(
  other: MappeTemplateOutline,
  mine: readonly T[],
  theirs: readonly T[],
  same: (a: T, b: T) => boolean,
  what: string,
): ContentProblem[] {
  const index = mine.findIndex((item, at) => !theirs[at] || !same(item, theirs[at]));
  const differs = index !== -1 || theirs.length !== mine.length;
  if (!differs) return [];
  const at = index === -1 ? mine.length : index;
  const line = (theirs[at] ?? theirs[theirs.length - 1])?.line;
  return [
    {
      file: other.file,
      ...(line === undefined ? {} : { line }),
      message: `${what} differ from ${NN} from here on; the three templates have the same ${what} in the same order`,
    },
  ];
}

function valueProblems(reference: MappeTemplateOutline, other: MappeTemplateOutline): ContentProblem[] {
  const shown = (key: string) => {
    const parts = key.split('/');
    const name = parts.pop() ?? key;
    return parts.length > 0 ? `{{${name}}} in {{#${parts.join('}} in {{#')}}}` : `{{${name}}}`;
  };
  const missing = [...reference.values.keys()]
    .filter((key) => !other.values.has(key))
    .map((key) => ({ file: other.file, message: `${shown(key)} is in ${NN} but not here` }));
  const extra = [...other.values.entries()]
    .filter(([key]) => !reference.values.has(key))
    .map(([key, line]) => ({ file: other.file, line, message: `${shown(key)} is here but not in ${NN}` }));
  return [...missing, ...extra];
}

/**
 * Compares the nb and en templates with the nn one.
 * @param reference - The nn template's outline.
 * @param others - The nb and en outlines.
 * @returns The problems, each in the nb or en file.
 * @spec MAPPE-002
 */
export function templateParityProblems(
  reference: MappeTemplateOutline,
  others: readonly MappeTemplateOutline[],
): ContentProblem[] {
  return others.flatMap((other) => [
    ...sequenceProblem(other, reference.markers, other.markers, (a, b) => a.name === b.name, 'markers'),
    ...sequenceProblem(
      other,
      reference.sections,
      other.sections,
      (a, b) => a.section === b.section,
      'sections',
    ),
    ...sequenceProblem(other, reference.headings, other.headings, (a, b) => a.level === b.level, 'headings'),
    ...valueProblems(reference, other),
  ]);
}
