/**
 * mappeTemplateSource — reads one pedagogisk mappe template (`content/mappe/template.<language>.md`) and cleans its
 * text for the tag check: the front matter and the `<!-- … -->` notes for editors are removed, and raw HTML and
 * images are refused, each problem with its line.
 *
 * Why: D-094 says the loader removes comments and front matter, so the proposal's notes for ALU (which name values
 *      such as `{{k}}` in prose) never reach the portfolio or the tag check. The portfolio is Markdown that becomes a
 *      PDF from semantic HTML without images (D-096), and a downloaded `.md` may be shown by a renderer with HTML on,
 *      so the template itself holds neither.
 * Spec: MAPPE-002, MAPPE-004
 * Invariants:
 *   - The cleaned text has exactly the lines of the file: a removed part keeps its line breaks, so every later
 *     problem names the line an editor sees.
 *   - Front matter is a block that opens with `---` on the first line and closes with `---` or `...`; it is ignored
 *     (the limits live in the criteria files).
 *   - `<` followed by a letter, `/`, `!` or `?` is refused outside a closed comment, so is `![`; an editor writes
 *     `&lt;` for a literal `<`.
 * Collaborators: ./mappeTemplateContent.ts (the caller), ./studioContentContext.ts, ./contentProblem.ts.
 * Tests: apps/server/test/learningDesign/content/mappeTemplateLoader.test.ts,
 *   apps/server/test/learningDesign/content/mappeTemplateStructure.test.ts
 */
import { readFileSync } from 'node:fs';
import type { Locale } from '../../i18n/translate.js';
import { contentDisplayPath } from './contentProblem.js';
import { studioContentFile, type StudioContentContext } from './studioContentContext.js';

/** The template's file in one language, relative to the content folder. */
export const mappeTemplateFileOf = (language: Locale): string => `mappe/template.${language}.md`;

/** A template file: absent, unreadable, or read with its text. */
export type MappeTemplateFile =
  | { readonly language: Locale; readonly file: string; readonly state: 'absent' }
  | { readonly language: Locale; readonly file: string; readonly state: 'unreadable'; readonly code: string }
  | { readonly language: Locale; readonly file: string; readonly state: 'read'; readonly source: string };

/** A problem in a template file before its file is named. */
export interface TemplateLineProblem {
  readonly line?: number;
  readonly message: string;
}

/**
 * Reads one language's template.
 * @param context - The content folder.
 * @param language - The language.
 * @returns The file's state; a missing file is `absent`, not a problem (the caller decides).
 */
export function readMappeTemplateFile(context: StudioContentContext, language: Locale): MappeTemplateFile {
  const path = studioContentFile(context, mappeTemplateFileOf(language));
  const file = contentDisplayPath(path);
  try {
    return { language, file, state: 'read', source: readFileSync(path, 'utf8') };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
    return code === 'ENOENT'
      ? { language, file, state: 'absent' }
      : { language, file, state: 'unreadable', code };
  }
}

/**
 * The 1-based line of a character offset.
 * @param text - The text.
 * @param offset - A 0-based offset into it.
 * @returns The line number.
 */
export const lineAt = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

// WHY: keeping the line breaks of a removed part keeps every later line number right.
const blankedOut = (part: string): string => part.replace(/[^\n]/g, '');

const FRONT_MATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;
const RAW_HTML = /<[A-Za-z/!?]/g;
const IMAGE = /!\[/g;

function withoutFrontMatter(source: string): { text: string; problems: TemplateLineProblem[] } {
  if (!/^---[ \t]*\r?\n/.test(source)) return { text: source, problems: [] };
  const match = FRONT_MATTER.exec(source);
  if (!match) {
    return {
      text: source,
      problems: [{ line: 1, message: 'the front matter that starts here is not closed with a line `---`' }],
    };
  }
  return { text: blankedOut(match[0]) + source.slice(match[0].length), problems: [] };
}

function withoutComments(source: string): { text: string; problems: TemplateLineProblem[] } {
  let text = '';
  let from = 0;
  for (;;) {
    const open = source.indexOf('<!--', from);
    if (open === -1) return { text: text + source.slice(from), problems: [] };
    const close = source.indexOf('-->', open + 4);
    if (close === -1) {
      const line = lineAt(source, open);
      return {
        text: text + source.slice(from),
        problems: [{ line, message: 'the comment `<!--` that starts here is not closed with `-->`' }],
      };
    }
    text += source.slice(from, open) + blankedOut(source.slice(open, close + 3));
    from = close + 3;
  }
}

const refusals = (text: string, pattern: RegExp, message: string): TemplateLineProblem[] =>
  [...text.matchAll(pattern)].map((match) => ({ line: lineAt(text, match.index), message }));

/**
 * Removes the front matter and the comments, and refuses raw HTML and images.
 * @param source - The file's text.
 * @returns The cleaned text, with the same lines as the file, and the problems found.
 * @spec MAPPE-002
 */
export function cleanMappeTemplate(source: string): { text: string; problems: TemplateLineProblem[] } {
  const front = withoutFrontMatter(source.replace(/^\uFEFF/, ''));
  const comments = withoutComments(front.text);
  const problems = [...front.problems, ...comments.problems];
  // WHY: after an unclosed comment the rest of the file would be reported as HTML once per tag; one problem is enough.
  if (comments.problems.length > 0) return { text: comments.text, problems };
  return {
    text: comments.text,
    problems: [
      ...problems,
      // SECURITY: a downloaded .md may be opened in a renderer with HTML on; the template must hold no HTML of its own.
      ...refusals(
        comments.text,
        RAW_HTML,
        'raw HTML is not allowed in the template; write &lt; for a literal <, and [text](https://…) for a link',
      ),
      // WHY: the PDF holds no images (D-096), and an image would be an empty box in it.
      ...refusals(comments.text, IMAGE, 'images are not allowed in the template'),
    ],
  };
}
