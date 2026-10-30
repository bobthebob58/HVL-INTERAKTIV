/**
 * mappeTemplateSegments — cuts a cleaned pedagogisk mappe template at its marker lines into the Mustache text the
 * renderer fills and the markers where the server puts its own blocks, and checks the markers.
 *
 * Why: the reader's guide and the references are Markdown the server builds (D-094), which Mustache could only
 *      insert unescaped with `{{{…}}}`, a form the loader refuses. Cutting the template at marker lines lets the
 *      renderer escape every value and still place its blocks, and tells the word count where Del 1 and the
 *      attachment list begin and end without parsing the rendered text.
 * Spec: MAPPE-002
 * Invariants:
 *   - A marker line holds only the tag, e.g. `{{del1_start}}` (spaces around it are allowed); it is not part of any
 *     text segment, so a section that would span it is reported as not closed.
 *   - Text segments keep their exact text and their start offset in the cleaned template, so every later problem
 *     names the file's own line.
 *   - Every marker stands exactly once; each pair's start comes before its end, and the two pairs do not overlap.
 * Collaborators: ./mappeTemplateContent.ts (the caller), ./mappeTemplateTags.ts, ../mappe/mappeVariables.ts.
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts,
 *   apps/server/test/learningDesign/content/mappeTemplateStructure.test.ts
 */
import {
  isMappeMarker,
  MAPPE_MARKER_PAIRS,
  MAPPE_MARKERS,
  type MappeMarker,
} from '../mappe/mappeVariables.js';
import type { TemplateLineProblem } from './mappeTemplateSource.js';

/** A part of a template: Mustache text, or a marker. */
export type MappeTemplateSegment =
  | {
      readonly kind: 'text';
      /** The exact text, which Mustache parses and renders. */
      readonly source: string;
      /** Where it starts in the cleaned template (0-based). */
      readonly offset: number;
    }
  | { readonly kind: 'marker'; readonly marker: MappeMarker; readonly line: number };

const MARKER_LINE = /^[ \t]*\{\{[ \t]*([A-Za-z0-9_]+)[ \t]*\}\}[ \t]*\r?$/;

/**
 * Cuts the template at its marker lines.
 * @param text - The cleaned template (./mappeTemplateSource.ts).
 * @returns The segments in order; a text segment may be empty.
 * @spec MAPPE-002
 */
export function cutAtMarkers(text: string): MappeTemplateSegment[] {
  const segments: MappeTemplateSegment[] = [];
  let start = 0;
  let offset = 0;
  text.split('\n').forEach((line, index) => {
    const name = MARKER_LINE.exec(line)?.[1];
    if (name !== undefined && isMappeMarker(name)) {
      segments.push({ kind: 'text', source: text.slice(start, offset), offset: start });
      segments.push({ kind: 'marker', marker: name, line: index + 1 });
      start = Math.min(text.length, offset + line.length + 1);
    }
    offset += line.length + 1;
  });
  segments.push({ kind: 'text', source: text.slice(start), offset: start });
  return segments;
}

const lineOfMarker = (segments: readonly MappeTemplateSegment[], marker: MappeMarker): number[] =>
  segments.flatMap((segment) =>
    segment.kind === 'marker' && segment.marker === marker ? [segment.line] : [],
  );

/**
 * Checks that every marker stands once and that the pairs are in order and apart.
 * @param segments - The template's segments.
 * @returns The problems, each at a marker's line (none for a missing marker).
 * @spec MAPPE-002
 */
export function markerProblems(segments: readonly MappeTemplateSegment[]): TemplateLineProblem[] {
  const problems: TemplateLineProblem[] = [];
  for (const marker of MAPPE_MARKERS) {
    const lines = lineOfMarker(segments, marker);
    if (lines.length === 0) {
      problems.push({
        message: `the marker {{${marker}}} is missing; it stands alone on its own line (see content/mappe/README.md)`,
      });
    }
    for (const line of lines.slice(1)) {
      problems.push({ line, message: `the marker {{${marker}}} stands more than once; keep one` });
    }
  }
  if (problems.length > 0) return problems;
  const regions = MAPPE_MARKER_PAIRS.map(([open, close]) => {
    const [from = 0] = lineOfMarker(segments, open);
    const [to = 0] = lineOfMarker(segments, close);
    return { open, close, from, to };
  });
  for (const region of regions) {
    if (region.from > region.to) {
      problems.push({
        line: region.to,
        message: `the marker {{${region.close}}} comes before {{${region.open}}}; it closes the part`,
      });
    }
  }
  const [first, second] = regions;
  if (problems.length === 0 && first && second && first.from < second.to && second.from < first.to) {
    problems.push({
      line: second.from,
      message: `the part {{${second.open}}} … {{${second.close}}} overlaps {{${first.open}}} … {{${first.close}}}`,
    });
  }
  return problems;
}
