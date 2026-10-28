/**
 * yamlKeyPaths — reads a parsed YAML document's syntax tree to name keys and lines: the line of a key path, the key
 * path written for an editor, and the repeated keys and aliases a content file may not contain.
 *
 * Why: zod reports a problem as a path into plain data (`['phases', 1, 'label', 'nb']`), and YAML's own parser lets a
 *      repeated key through or names neither key nor line. ALU needs both (D-073, D-082), so the problems are placed
 *      by walking the document's tree, whose nodes keep their source offsets.
 * Spec: PED-001, PED-020
 * Invariants:
 *   - A list item that is a map with a text `key` or `id` is named by it (`phases[underveis]`), otherwise by its
 *     1-based position (`phases[#2]`), so the name matches what the editor sees in the file.
 *   - A repeated key is reported at its second and later occurrences, at any depth.
 *   - Aliases (`*name`) and keys that are not plain text are refused: content is written out in full.
 *   - The key `__proto__` is refused at any depth: zod's records drop it without a word, so a list keyed by name
 *     (references, criteria) would lose that entry silently.
 *   - A path that leads to a missing key gives the line of the nearest key above it.
 * Collaborators: ./yamlContentFile.ts (the only caller), the `yaml` package's Document, YAMLMap and YAMLSeq.
 * Tests: apps/server/test/learningDesign/content/yamlContentFile.test.ts
 */
import { isAlias, isMap, isScalar, isSeq, type Document, type LineCounter } from 'yaml';
import type { ContentProblem } from './contentProblem.js';

/** One step of a key path: a map key or a 0-based list index. */
export type KeyPathSegment = string | number;

type Ranged = { range?: readonly [number, number, number] | null };

const lineOf = (node: unknown, lines: LineCounter): number | undefined => {
  const range = (node as Ranged | null | undefined)?.range;
  return range ? lines.linePos(range[0]).line : undefined;
};

const childPair = (node: unknown, name: string) =>
  isMap(node) ? node.items.find((pair) => isScalar(pair.key) && String(pair.key.value) === name) : undefined;

// WHY: an editor looks for `key: underveis` in the file, not for "item 1"; a map item without such a field is
// numbered from 1, as a person counts list items.
const itemName = (item: unknown, index: number): string => {
  for (const field of ['key', 'id']) {
    const value = childPair(item, field)?.value;
    if (isScalar(value) && typeof value.value === 'string' && value.value !== '') return value.value;
  }
  return `#${index + 1}`;
};

/**
 * Writes a key path for an editor.
 * @param document - The parsed document, used to name list items.
 * @param path - The path, e.g. `['phases', 1, 'label', 'nb']`.
 * @returns e.g. `phases[underveis].label.nb`, or undefined for the empty path (the whole file).
 */
export function formatKeyPath(document: Document, path: readonly KeyPathSegment[]): string | undefined {
  let node: unknown = document.contents;
  let text = '';
  for (const segment of path) {
    if (isSeq(node) && typeof segment === 'number') {
      const item: unknown = node.items[segment];
      text += `[${itemName(item, segment)}]`;
      node = item;
    } else {
      text += text === '' ? String(segment) : `.${String(segment)}`;
      node = childPair(node, String(segment))?.value;
    }
  }
  return text === '' ? undefined : text;
}

/**
 * Finds the line of a key path: the line of its last key, or of the nearest key above it when it is missing.
 * @param document - The parsed document.
 * @param lines - The line counter the document was parsed with.
 * @param path - The path.
 * @returns The 1-based line, or undefined for the empty path or a missing top-level key.
 */
export function lineOfKeyPath(
  document: Document,
  lines: LineCounter,
  path: readonly KeyPathSegment[],
): number | undefined {
  let node: unknown = document.contents;
  let line: number | undefined;
  for (const segment of path) {
    if (isSeq(node) && typeof segment === 'number' && node.items[segment] !== undefined) {
      node = node.items[segment];
      line = lineOf(node, lines) ?? line;
      continue;
    }
    const pair = childPair(node, String(segment));
    if (!pair) break;
    line = lineOf(pair.key, lines) ?? line;
    node = pair.value;
  }
  return line;
}

/**
 * Finds the structure a content file may not use: repeated keys, aliases, keys that are not plain text and the key
 * `__proto__`.
 * @param document - The parsed document (parsed with `uniqueKeys: false`, so repeats reach the tree).
 * @param lines - The line counter the document was parsed with.
 * @param file - The display path for the problems.
 * @returns The problems, and whether an alias was found (the data must then not be built).
 */
export function findStructureProblems(
  document: Document,
  lines: LineCounter,
  file: string,
): { readonly problems: ContentProblem[]; readonly hasAlias: boolean } {
  const problems: ContentProblem[] = [];
  let hasAlias = false;
  const report = (path: readonly KeyPathSegment[], node: unknown, message: string) =>
    problems.push({ file, line: lineOf(node, lines), key: formatKeyPath(document, path), message });
  const walk = (node: unknown, path: readonly KeyPathSegment[]): void => {
    if (isAlias(node)) {
      hasAlias = true;
      report(path, node, `uses the alias *${node.source}; write the value out instead`);
    } else if (isMap(node)) {
      const seen = new Set<string>();
      for (const pair of node.items) {
        if (!isScalar(pair.key)) {
          report(path, pair.key ?? node, 'has a key that is not plain text');
          continue;
        }
        const name = String(pair.key.value);
        // SECURITY: `__proto__` is also the one key that could change an object's prototype in other readers.
        if (name === '__proto__') report([...path, name], pair.key, 'is not allowed as a key');
        if (seen.has(name)) report([...path, name], pair.key, 'appears more than once');
        seen.add(name);
        walk(pair.value, [...path, name]);
      }
    } else if (isSeq(node)) {
      node.items.forEach((item, index) => walk(item, [...path, index]));
    }
  };
  walk(document.contents, []);
  return { problems, hasAlias };
}
