/**
 * mappeValuePlaces — decides whether a value tag (`{{name}}`) stands where the Markdown escaper keeps a teacher's
 * text as text, or in one of the places probe P5 showed it cannot.
 *
 * Why: the escaper (../mappe/markdownEscape.ts) is safe in inline positions only: line starts, after a heading, list
 *      or quote marker, mid-line, table cells and link text. D-094's probe amendment therefore has the loader refuse
 *      a value inside backticks (a backtick in the value would close the code span), straight after `](` or anywhere
 *      in a link destination (the escapes are not undone there), straight after a backslash (it would escape the
 *      value's first character), and at the start of a line that follows a table header (the line could become the
 *      table's delimiter row). The W6a review added two more: straight after `<` (raw HTML or an autolink) and
 *      straight after `]` (a value starting with `(` would make the brackets a link), D-094 W6a amendment.
 * Spec: MAPPE-002
 * Invariants:
 *   - Pure: reads the cleaned template text (comments already removed, same lines as the file) and an offset.
 *   - Errs on the side of refusing: a code span is tracked from the start of its paragraph, as CommonMark lets one
 *     run across lines, and any fenced block counts as code.
 * Collaborators: ./mappeTemplateTags.ts (calls it for every value tag).
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts
 */

/** A place where a value may not stand, with the plain-English reason. */
export type RefusedValuePlace = string;

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** The lines of a text with the offset each starts at. */
export interface TextLines {
  readonly lines: readonly string[];
  readonly starts: readonly number[];
}

/**
 * Splits a text into lines with their start offsets.
 * @param text - The cleaned template.
 * @returns The lines and where each starts.
 */
export function textLines(text: string): TextLines {
  const lines = text.split('\n');
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + 1;
  }
  return { lines, starts };
}

/** The 0-based index of the line holding an offset. */
function lineIndexOf(text: TextLines, offset: number): number {
  let index = 0;
  while (index + 1 < text.starts.length && (text.starts[index + 1] ?? Infinity) <= offset) index += 1;
  return index;
}

const insideFence = (text: TextLines, lineIndex: number): boolean => {
  let fence: string | undefined;
  for (let index = 0; index < lineIndex; index += 1) {
    const marker = FENCE.exec(text.lines[index] ?? '')?.[1];
    if (!marker) continue;
    if (fence === undefined) fence = marker;
    else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
  }
  return fence !== undefined;
};

// WHY: a code span opens with a run of backticks and closes with a run of the same length; it may run across the
// lines of one paragraph, so the scan starts after the last blank line.
const insideCodeSpan = (text: TextLines, lineIndex: number, column: number): boolean => {
  let first = lineIndex;
  while (first > 0 && (text.lines[first - 1] ?? '').trim() !== '') first -= 1;
  const before = [...text.lines.slice(first, lineIndex), (text.lines[lineIndex] ?? '').slice(0, column)].join(
    '\n',
  );
  let open = 0;
  for (const run of before.match(/`+/g) ?? []) {
    if (open === 0) open = run.length;
    else if (run.length === open) open = 0;
  }
  return open > 0;
};

/**
 * Why a value tag may not stand at an offset, or undefined when it may.
 * @param text - The cleaned template's lines.
 * @param offset - Where the tag's `{{` starts.
 * @returns The reason, e.g. `a value cannot stand inside backticks …`, or undefined.
 * @spec MAPPE-002
 */
export function refusedValuePlace(text: TextLines, offset: number): RefusedValuePlace | undefined {
  const lineIndex = lineIndexOf(text, offset);
  const line = text.lines[lineIndex] ?? '';
  const column = offset - (text.starts[lineIndex] ?? 0);
  const before = line.slice(0, column);
  if (insideFence(text, lineIndex) || insideCodeSpan(text, lineIndex, column)) {
    return 'a value cannot stand inside backticks or a code block, where its text could end the code';
  }
  // SECURITY: the escapes are not undone in a link destination, and a crafted value could change the link target.
  if (/\]\([^)]*$/.test(before) || /^\s*\[[^\]]*\]:/.test(before)) {
    return 'a value cannot stand in a link address; put it in the link text or after the link';
  }
  if (before.endsWith('\\'))
    return 'a value cannot follow a backslash, which would escape its first character';
  // SECURITY: the escaper leaves `(`, `:` and letters alone, so after the template's own `<` a value such as
  // `script>` would open raw HTML (or an autolink), and after its `]` a value such as `(https://…)` would make the
  // brackets before it a link to the value's address.
  if (before.endsWith('<'))
    return 'a value cannot follow <, where its text could become HTML or a link; write the address as plain text';
  if (before.endsWith(']'))
    return 'a value cannot follow ] straight away, where its text could turn the brackets into a link; add a space';
  const previous = lineIndex > 0 ? (text.lines[lineIndex - 1] ?? '') : '';
  if (before.trim() === '' && previous.includes('|')) {
    return (
      'a value cannot start a line right after a table line, where it could turn the line into the table’s ' +
      'header separator; start the line with text or a table cell'
    );
  }
  return undefined;
}
