/**
 * skeletonFieldWalk — walks a pattern skeleton's parameters along the semantics of the installed libraries and
 * collects what the content check needs: each sub-content library with the versions its field offers, and each text
 * field with its length limit.
 *
 * Why: a skeleton is refused by the editor's save path when a sub-content names a version its field does not offer,
 *      and Lumi clips a text longer than its field's `maxLength` (D-084 amendment). The content check finds both
 *      before a pattern reaches an author; the loader is synchronous, so this walk is too.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - Follows H5P's layout as the semantics defaults do (../patterns/semanticDefaults.ts): a group of one field holds
 *     that field's value directly, unless it is sub-content; lists are arrays; a `library` value is
 *     `{ library: "H5P.Name x.y", params, metadata }` whose params use that library's semantics.
 *   - A sub-content library that is not installed is still collected (so the check can name it); its parameters
 *     are not walked. Keys the semantics do not define are not walked.
 *   - Paths are key paths in the skeleton file (`params.questions[0]…`), as the problems name them.
 *   - Pure: reads only the catalogue it is given; nesting deeper than MAX_DEPTH is not followed.
 * Collaborators: ./installedLibraries.ts (the catalogue), ./skeletonLibraryChecks.ts (the caller).
 * Tests: apps/server/test/learningDesign/content/patternLibraryChecks.test.ts
 */
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import type { InstalledLibraryCatalogue } from './installedLibraries.js';
import type { KeyPathSegment } from './yamlKeyPaths.js';

/** A key path in a skeleton file. */
export type SkeletonPath = readonly KeyPathSegment[];

/** A sub-content node: the library it names and the versions its field offers. */
export interface SkeletonLibraryUse {
  /** The path of the node's `library` key. */
  readonly path: SkeletonPath;
  readonly library: string;
  /** The options of the field that holds it, e.g. `['H5P.MultiChoice 1.16', 'H5P.Blanks 1.14']`. */
  readonly offered: readonly string[];
}

/** A text field (or a text list item) with its value. */
export interface SkeletonTextField {
  readonly path: SkeletonPath;
  readonly text: string;
  /** The field's `maxLength`, when it has one. */
  readonly maxLength?: number;
}

/** What the walk found. */
export interface SkeletonFields {
  readonly libraries: readonly SkeletonLibraryUse[];
  readonly texts: readonly SkeletonTextField[];
}

type Field = ISemanticsEntry & { readonly isSubContent?: boolean };
type Found = { libraries: SkeletonLibraryUse[]; texts: SkeletonTextField[] };

// WHY: content.json nests about 15 levels; a bound keeps a malformed skeleton from exhausting the stack.
const MAX_DEPTH = 100;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionNames = (field: Field): string[] =>
  (field.options ?? []).flatMap((option: unknown) => {
    const name = typeof option === 'string' ? option : (option as { name?: unknown } | null)?.name;
    return typeof name === 'string' ? [name] : [];
  });

function walkValue(
  field: Field,
  value: unknown,
  path: SkeletonPath,
  found: Found,
  catalogue: InstalledLibraryCatalogue,
): void {
  if (value === undefined || path.length > MAX_DEPTH) return;
  const fields = (field.fields ?? []) as Field[];
  const [only] = fields;
  if (field.type === 'group' && fields.length === 1 && only && !field.isSubContent) {
    // WHY: H5P stores a group of one field as that field's value (the semantics defaults' flattening rule).
    walkValue({ ...only, name: field.name }, value, path, found, catalogue);
  } else if (field.type === 'group' && isObject(value)) {
    walkFields(fields, value, path, found, catalogue);
  } else if (field.type === 'list' && Array.isArray(value) && field.field) {
    const item = field.field as Field;
    value.forEach((entry: unknown, index) => walkValue(item, entry, [...path, index], found, catalogue));
  } else if (field.type === 'library' && isObject(value) && typeof value.library === 'string') {
    found.libraries.push({ path: [...path, 'library'], library: value.library, offered: optionNames(field) });
    const semantics = catalogue.semanticsOf(value.library);
    if (semantics && isObject(value.params))
      walkFields(semantics as Field[], value.params, [...path, 'params'], found, catalogue);
  } else if (field.type === 'text' && typeof value === 'string') {
    const maxLength = typeof field.maxLength === 'number' ? field.maxLength : undefined;
    found.texts.push({ path, text: value, ...(maxLength === undefined ? {} : { maxLength }) });
  }
}

function walkFields(
  fields: readonly Field[],
  params: Record<string, unknown>,
  path: SkeletonPath,
  found: Found,
  catalogue: InstalledLibraryCatalogue,
): void {
  for (const field of fields) walkValue(field, params[field.name], [...path, field.name], found, catalogue);
}

/**
 * Walks a skeleton's parameters along the semantics of its main library and of every sub-content.
 * @param params - The skeleton's `params`.
 * @param semantics - The main library's semantics (from the catalogue).
 * @param catalogue - The installed libraries.
 * @returns The sub-content libraries and text fields, in document order.
 * @spec PED-010
 */
export function walkSkeletonFields(
  params: Readonly<Record<string, unknown>>,
  semantics: readonly ISemanticsEntry[],
  catalogue: InstalledLibraryCatalogue,
): SkeletonFields {
  const found: Found = { libraries: [], texts: [] };
  walkFields(semantics as Field[], params, ['params'], found, catalogue);
  return found;
}
