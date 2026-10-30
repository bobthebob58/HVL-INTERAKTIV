/**
 * contentSource — reads one pattern file (`pattern.yaml` or a skeleton JSON) and keeps a way to name the line and the
 * key of any path in it, for the checks that run after the file's own schema has passed.
 *
 * Why: a pattern's problems are often found only when its files are compared (a token the skeleton uses but
 *      `pattern.yaml` lacks, a library version the field does not offer). ALU still needs the file, the line and the
 *      key of each (D-082), so the parsed document's syntax tree is kept for those later checks.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - A skeleton must be JSON: `JSON.parse` decides, and its error names the line; YAML's parser is then used only
 *     to check the schema, repeated keys and `__proto__` (./yamlContentFile.ts) and to find lines.
 *   - An unreadable file is one problem naming the error code, as ./yamlContentFile.ts reports it.
 *   - Locating never throws; a path that leads to a missing key names the nearest key above it.
 * Collaborators: ./yamlContentFile.ts, ./yamlKeyPaths.ts, ./contentProblem.ts, ./patternYaml.ts,
 *   ./skeletonFile.ts.
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts
 */
import { readFileSync } from 'node:fs';
import { LineCounter, parseDocument } from 'yaml';
import type { z } from 'zod';
import { contentDisplayPath, type ContentProblem } from './contentProblem.js';
import { formatKeyPath, lineOfKeyPath, type KeyPathSegment } from './yamlKeyPaths.js';
import { contentLoadFailed, parseYamlContent, type ContentLoadResult } from './yamlContentFile.js';

/** Names the line and the key of a path in a loaded file. */
export type ContentLocator = (path: readonly KeyPathSegment[]) => { line?: number; key?: string };

/** A loaded file: its checked value, its display path and a locator. */
export interface ContentSource<T> {
  readonly value: T;
  /** The display path (see `contentDisplayPath`). */
  readonly file: string;
  readonly locate: ContentLocator;
}

/** A loaded file, or every problem found while loading it. */
export type ContentSourceResult<T> =
  | ({ readonly ok: true } & ContentSource<T>)
  | { readonly ok: false; readonly problems: readonly ContentProblem[] };

/**
 * A problem at a path of a loaded file.
 * @param source - The loaded file.
 * @param path - The key path.
 * @param message - What is wrong, in plain English.
 * @returns The problem with its file, line and key.
 */
export function problemAt(
  source: Pick<ContentSource<unknown>, 'file' | 'locate'>,
  path: readonly KeyPathSegment[],
  message: string,
): ContentProblem {
  const { line, key } = source.locate(path);
  return {
    file: source.file,
    ...(line === undefined ? {} : { line }),
    ...(key === undefined ? {} : { key }),
    message,
  };
}

function locatorOf(text: string): ContentLocator {
  const lines = new LineCounter();
  const document = parseDocument(text, { uniqueKeys: false, lineCounter: lines });
  return (path) => {
    const line = lineOfKeyPath(document, lines, path);
    const key = formatKeyPath(document, path);
    return { ...(line === undefined ? {} : { line }), ...(key === undefined ? {} : { key }) };
  };
}

const jsonProblem = (text: string, file: string): ContentProblem | undefined => {
  try {
    JSON.parse(text);
    return undefined;
  } catch (error) {
    const message = (error as Error).message;
    // WHY: V8 ends the message with "(line L column C)"; the line goes into the problem, the rest is the mistake.
    const line = /\(line (\d+) column \d+\)/.exec(message)?.[1];
    return {
      file,
      ...(line ? { line: Number(line) } : {}),
      message: `is not valid JSON: ${message.replace(/ in JSON at position \d+.*$/, '')}`,
    };
  }
};

/**
 * Reads and checks one pattern file.
 * @param absolutePath - The file on disk.
 * @param schema - A strict zod schema of the whole file.
 * @param format - `yaml` for pattern.yaml, `json` for a skeleton.
 * @returns The value with its locator, or every problem.
 * @spec PED-011
 */
export function readContentSource<T>(
  absolutePath: string,
  schema: z.ZodType<T>,
  format: 'yaml' | 'json',
): ContentSourceResult<T> {
  const file = contentDisplayPath(absolutePath);
  let text: string;
  try {
    text = readFileSync(absolutePath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
    return { ok: false, problems: [{ file, message: `cannot read the file (${code})` }] };
  }
  const notJson = format === 'json' ? jsonProblem(text, file) : undefined;
  const parsed: ContentLoadResult<T> = notJson
    ? contentLoadFailed([notJson])
    : parseYamlContent(text, schema, file);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value, file, locate: locatorOf(text) };
}
