/**
 * mappeTemplateTags — reads the Mustache tags of a pedagogisk mappe template's text segments and checks each one
 * against the allowlist: only values, lists and comments with known names, each value in a place the Markdown
 * escaper keeps safe. It also collects what the three languages must share (the values per list and the sections).
 *
 * Why: D-094 (probe P5 amendment) allows only `name`, `#`, `^` and `!` tags with allowlisted names and refuses `&`
 *      (which also covers triple braces), `>` and `=`. A value Mustache cannot find renders as nothing, so a misspelt
 *      name would silently drop a teacher's text; refusing it at load keeps the portfolio complete.
 * Spec: MAPPE-002
 * Invariants:
 *   - Reads `Mustache.parse`'s spans and never changes them: they are cached and reused by `render` (probe P5).
 *   - A list is opened only where it is defined (`aktivitetar` and `emneoversikt` at the top, `uu_merknader` inside
 *     `aktivitetar`); inside one, the names of the levels around it are allowed too.
 *   - Every problem has the line of its tag in the cleaned template, which has the file's lines.
 * Collaborators: ./mappeTemplateContent.ts (the caller), ./mappeValuePlaces.ts, ./mappeTemplateSegments.ts,
 *   ../mappe/mappeVariables.ts, mustache 4.2.0.
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts
 */
import Mustache, { type TemplateSpans } from 'mustache';
import { isMappeMarker, MAPPE_TEMPLATE_SCOPE, type MappeScope } from '../mappe/mappeVariables.js';
import { refusedValuePlace, textLines, type TextLines } from './mappeValuePlaces.js';
import { lineAt, type TemplateLineProblem } from './mappeTemplateSource.js';
import type { MappeTemplateSegment } from './mappeTemplateSegments.js';

/** The delimiters every template uses; a template cannot change them (`=` tags are refused). */
export const MAPPE_TAGS: [string, string] = ['{{', '}}'];

/** What the three languages' templates must share. */
export interface MappeTemplateTagOutline {
  /** Each section as `#list` or `^list`, indented by its depth, in template order. */
  readonly sections: readonly { readonly section: string; readonly line: number }[];
  /** Each value used, as `list/name` or `name` at the top, with the line of its first use. */
  readonly values: ReadonlyMap<string, number>;
}

interface Walk {
  readonly text: string;
  readonly lines: TextLines;
  readonly offset: number;
  readonly problems: TemplateLineProblem[];
  readonly sections: { section: string; line: number }[];
  readonly values: Map<string, number>;
}

const REFUSED_TYPES: Readonly<Record<string, string>> = {
  '&': 'triple braces and {{&…}} are not allowed: every value is shown as plain text, so write {{name}}',
  '>': 'partials ({{>…}}) are not allowed',
  '=': 'changing the tag delimiters ({{=… =}}) is not allowed',
};

const inScope = (chain: readonly MappeScope[], name: string) => chain.some((s) => s.values.includes(name));

/** The list a name belongs to anywhere in the allowlist (`''` for the top), or undefined for an unknown name. */
function homeOf(name: string, scope: MappeScope = MAPPE_TEMPLATE_SCOPE, list = ''): string | undefined {
  if (scope.values.includes(name) || Object.hasOwn(scope.lists, name)) return list;
  for (const [child, inner] of Object.entries(scope.lists)) {
    const home = homeOf(name, inner, child);
    if (home !== undefined) return home;
  }
  return undefined;
}

const elsewhere = (name: string, what: string): string => {
  const home = homeOf(name);
  if (home === undefined)
    return `${what} is not a name the portfolio knows (see content/mappe/README.md for the names)`;
  return home === ''
    ? `${what} cannot stand here: it belongs outside every section`
    : `${what} cannot stand here: it belongs inside {{#${home}}} … {{/${home}}}`;
};

function checkSpans(walk: Walk, spans: TemplateSpans, chain: readonly MappeScope[], path: string[]): void {
  const scope: MappeScope = chain[chain.length - 1] ?? MAPPE_TEMPLATE_SCOPE;
  for (const span of spans) {
    const [type, name, start] = span;
    if (type === 'text' || type === '!') continue;
    const offset = walk.offset + start;
    const line = lineAt(walk.text, offset);
    const problem = (message: string) => walk.problems.push({ line, message });
    if (REFUSED_TYPES[type]) {
      problem(REFUSED_TYPES[type]);
    } else if (type === 'name') {
      if (isMappeMarker(name))
        problem(`the marker {{${name}}} must stand alone on its own line, outside sections`);
      else if (inScope(chain, name)) {
        const refused = refusedValuePlace(walk.lines, offset);
        if (refused) problem(refused);
        const key = [...path, name].join('/');
        if (!walk.values.has(key)) walk.values.set(key, line);
      } else if (Object.hasOwn(scope.lists, name))
        problem(`{{${name}}} is a list: write {{#${name}}} … {{/${name}}}`);
      else problem(elsewhere(name, `{{${name}}}`));
    } else if (type === '#' || type === '^') {
      const list = Object.hasOwn(scope.lists, name) ? scope.lists[name] : undefined;
      if (!list) {
        problem(
          inScope(chain, name)
            ? `{{${type}${name}}} is a value, not a list: a section opens one of the lists`
            : elsewhere(name, `{{${type}${name}}}`),
        );
        continue;
      }
      walk.sections.push({ section: `${'  '.repeat(path.length)}${type}${name}`, line });
      // WHY: a section's children are at index 4 of its span (probe P5).
      const children = (span as unknown[])[4];
      if (Array.isArray(children))
        checkSpans(walk, children as TemplateSpans, [...chain, list], [...path, name]);
    } else {
      problem(`the tag {{${type}${name}}} is not one the portfolio template allows`);
    }
  }
}

const OPENING = (name: string) =>
  new RegExp(`\\{\\{\\s*[#^]\\s*${name.replace(/\W/g, '\\$&')}\\s*\\}\\}`, 'g');

/** Turns Mustache's parse error into a problem on the line an editor sees. */
function parseProblem(
  error: Error,
  text: string,
  segment: { source: string; offset: number },
  next?: string,
) {
  const at = Number(/ at (\d+)$/.exec(error.message)?.[1] ?? 0);
  const unclosed = /^Unclosed section "([^"]+)"/.exec(error.message)?.[1];
  if (unclosed !== undefined) {
    const opened = [...segment.source.matchAll(OPENING(unclosed))].pop()?.index ?? at;
    return {
      line: lineAt(text, segment.offset + opened),
      message: next
        ? `the section {{#${unclosed}}} is not closed before the marker {{${next}}}; a marker cannot stand in a section`
        : `the section {{#${unclosed}}} is not closed with {{/${unclosed}}}`,
    };
  }
  const unopened = /^Unopened section "([^"]+)"/.exec(error.message)?.[1];
  const line = lineAt(text, segment.offset + at);
  if (unopened !== undefined) return { line, message: `{{/${unopened}}} closes a section that is not open` };
  if (error.message.startsWith('Unclosed tag')) {
    // WHY: Mustache reports where it gave up (the end of the text); the editor needs the line of the opening `{{`.
    const opened = Math.max(0, segment.source.lastIndexOf('{{', Math.max(0, at - 2)));
    return { line: lineAt(text, segment.offset + opened), message: 'a tag that opens with {{ is not closed' };
  }
  return { line, message: `the template cannot be read: ${error.message}` };
}

/**
 * Checks every tag of a template's text segments.
 * @param text - The cleaned template.
 * @param segments - Its segments (./mappeTemplateSegments.ts).
 * @returns The problems and the outline the languages must share.
 * @spec MAPPE-002
 */
export function checkMappeTemplateTags(
  text: string,
  segments: readonly MappeTemplateSegment[],
): { problems: TemplateLineProblem[]; outline: MappeTemplateTagOutline } {
  const problems: TemplateLineProblem[] = [];
  const sections: { section: string; line: number }[] = [];
  const values = new Map<string, number>();
  const lines = textLines(text);
  segments.forEach((segment, index) => {
    if (segment.kind !== 'text') return;
    const following = segments[index + 1];
    let spans: TemplateSpans;
    try {
      spans = Mustache.parse(segment.source, MAPPE_TAGS);
    } catch (error) {
      const next = following?.kind === 'marker' ? following.marker : undefined;
      problems.push(parseProblem(error as Error, text, segment, next));
      return;
    }
    const walk = { text, lines, offset: segment.offset, problems, sections, values };
    checkSpans(walk, spans, [MAPPE_TEMPLATE_SCOPE], []);
  });
  return { problems, outline: { sections, values } };
}
