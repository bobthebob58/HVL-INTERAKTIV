/**
 * yamlContentFile — reads one YAML file from `content/` and checks it with a strict zod schema, giving either the
 * frozen value or every problem, each naming the file, the line and the key.
 *
 * Why: the hint thresholds (D-073) and the studio's phases, references, patterns and portfolio criteria (D-082) are
 *      YAML that ALU edits by hand. A typo must stop the start with a message that says where it is, never switch a
 *      feature off silently. One reader keeps the rules and the wording the same for every content file.
 * Spec: PED-001, PED-020
 * Invariants:
 *   - Repeated keys (at any depth), aliases and syntax errors are problems; the schema should be strict, so unknown
 *     keys are problems too, each reported at the unknown key's own line.
 *   - Every problem is collected before returning; problems are ordered by line.
 *   - A returned value is deeply frozen; nothing is returned when there is any problem.
 *   - Problems name keys and lines only; the file's text is never echoed beyond what zod's message says.
 * Collaborators: ./yamlKeyPaths.ts, ./contentProblem.ts, ./deepFreeze.ts; callers ../../config/validationContext.ts,
 *   ./phasesContent.ts, ./referencesContent.ts, ./contentSource.ts and the guide, pattern and mappe loaders.
 * Tests: apps/server/test/learningDesign/content/yamlContentFile.test.ts,
 *   apps/server/test/config/validationContext.test.ts
 */
import { readFileSync } from 'node:fs';
import { LineCounter, parseDocument, type Document, type YAMLError } from 'yaml';
import type { z } from 'zod';
import { contentDisplayPath, sortContentProblems, type ContentProblem } from './contentProblem.js';
import { deepFreeze } from './deepFreeze.js';
import { findStructureProblems, formatKeyPath, lineOfKeyPath, type KeyPathSegment } from './yamlKeyPaths.js';

/** A loaded content value, or every problem found while loading it. */
export type ContentLoadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problems: readonly ContentProblem[] };

/**
 * A failed result.
 * @param problems - At least one problem.
 * @returns The result.
 */
export const contentLoadFailed = <T>(problems: readonly ContentProblem[]): ContentLoadResult<T> => ({
  ok: false,
  problems: sortContentProblems(problems),
});

// WHY: zod's default text for a missing key is "Invalid input: expected string, received undefined", which an editor
// cannot act on. A schema's own message (e.g. a missing language) takes precedence over these.
const plainMessages: z.core.$ZodErrorMap = (issue) => {
  if (issue.code !== 'invalid_type') return undefined;
  if (issue.input === undefined) return 'is missing';
  if (issue.input === null) return 'is empty';
  return undefined;
};

const syntaxProblem = (error: YAMLError, file: string): ContentProblem => ({
  file,
  line: error.linePos?.[0].line,
  // WHY: the first line of the parser's message names the mistake; the rest repeats the source with a caret.
  message: `YAML syntax: ${(error.message.split('\n')[0] ?? '').replace(/ at line \d+, column \d+:?$/, '')}`,
});

const issueProblems = (
  issues: readonly z.core.$ZodIssue[],
  document: Document,
  lines: LineCounter,
  file: string,
): ContentProblem[] =>
  issues.flatMap((issue) => {
    const path = issue.path.map((segment) => (typeof segment === 'number' ? segment : String(segment)));
    const at = (where: readonly KeyPathSegment[], message: string): ContentProblem => ({
      file,
      line: lineOfKeyPath(document, lines, where),
      key: formatKeyPath(document, where),
      message,
    });
    if (issue.code === 'unrecognized_keys')
      return issue.keys.map((key) => at([...path, key], 'is not a known key (check the spelling)'));
    if (issue.code === 'invalid_key') return [at(path, issue.issues[0]?.message ?? issue.message)];
    return [at(path, issue.message)];
  });

/**
 * Parses YAML text and checks it with a schema.
 * @param source - The YAML text.
 * @param schema - A strict zod schema of the whole file.
 * @param file - The display path for problems (see `contentDisplayPath`).
 * @returns The frozen value, or every problem: syntax, repeated keys, aliases, and the schema's issues.
 * @spec PED-001
 */
export function parseYamlContent<T>(
  source: string,
  schema: z.ZodType<T>,
  file: string,
): ContentLoadResult<T> {
  const lines = new LineCounter();
  // WHY: repeated keys are let through the parser and reported by name and line below; YAML's own error does not
  // name them, and it would hide every other problem in the file.
  const document = parseDocument(source, { uniqueKeys: false, lineCounter: lines });
  const syntax = [...document.errors, ...document.warnings];
  if (syntax.length > 0) return contentLoadFailed(syntax.map((error) => syntaxProblem(error, file)));
  const structure = findStructureProblems(document, lines, file);
  // SECURITY: aliases could expand a small file into a huge value ("billion laughs"); they are refused above and
  // the data is never built from a document that has one.
  if (structure.hasAlias) return contentLoadFailed(structure.problems);
  const parsed = schema.safeParse(document.toJS(), { error: plainMessages });
  const problems = parsed.success
    ? structure.problems
    : [...structure.problems, ...issueProblems(parsed.error.issues, document, lines, file)];
  if (problems.length > 0 || !parsed.success) return contentLoadFailed(problems);
  return { ok: true, value: deepFreeze(parsed.data) };
}

/**
 * Reads a YAML file and checks it with a schema.
 * @param absolutePath - The file on disk.
 * @param schema - A strict zod schema of the whole file.
 * @returns The frozen value, or every problem; an unreadable file is one problem naming the error code.
 * @spec PED-001
 */
export function readYamlContentFile<T>(absolutePath: string, schema: z.ZodType<T>): ContentLoadResult<T> {
  const file = contentDisplayPath(absolutePath);
  let source: string;
  try {
    source = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
    return contentLoadFailed([{ file, message: `cannot read the file (${code})` }]);
  }
  return parseYamlContent(source, schema, file);
}
