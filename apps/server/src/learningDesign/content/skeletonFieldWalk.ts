/**
 * skeletonFieldWalk — walks a pattern skeleton's parameters along the semantics of the installed libraries and
 * collects what the content check needs: each sub-content library with the versions its field offers, each text
 * field with its length limit, and each key the semantics do not define.
 *
 * Why: a skeleton is refused by the editor's save path when a sub-content names a version its field does not offer,
 *      and Lumi clips a text longer than its field's `maxLength` (D-084 amendment). A key the semantics do not
 *      define is kept but never read, so a misspelt `enableRetry` would silently leave a formative switch at the
 *      library's default (PROD-009). The content check finds all three before a pattern reaches an author; the
 *      loader is synchronous, so this walk is too.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - Follows H5P's layout as the semantics defaults do (../patterns/semanticDefaults.ts): a group of one field holds
 *     that field's value directly, unless it is sub-content; lists are arrays; a `library` value is
 *     `{ library: "H5P.Name x.y", params, metadata }` whose params use that library's semantics.
 *   - A sub-content library that is not installed is still collected (so the check can name it); its parameters
 *     are not walked. Keys the semantics do not define are collected, not walked; inside a sub-content whose
 *     version its field does not offer (already a problem) no key is collected.
 *   - The keys a sub-content node may hold are H5P's own: `library`, `params`, `metadata` and `subContentId`; a
 *     sub-content group (`isSubContent`, e.g. H5P.Summary's statements) may also hold `subContentId`. A key a
 *     library's own editor writes beside its semantics (EDITOR_KEYS) is no misspelling either, so a skeleton made
 *     from an exported `.h5p` file passes as exported.
 *   - Paths are key paths in the skeleton file (`params.questions[0]…`), as the problems name them.
 *   - Pure: reads only the catalogue it is given; nesting deeper than MAX_DEPTH is not followed.
 * Collaborators: ./installedLibraries.ts (the catalogue), ./skeletonLibraryChecks.ts (the caller).
 * Tests: apps/server/test/learningDesign/content/patternLibraryChecks.test.ts,
 *   apps/server/test/learningDesign/content/skeletonUnknownKeys.test.ts (H5P's own storage shapes)
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

/** A key of the skeleton that the semantics at its place do not define, so H5P never reads it. */
export interface SkeletonUnknownKey {
  /** The path of the key itself. */
  readonly path: SkeletonPath;
  /** The library whose semantics (or sub-content node) the key sits in, e.g. `H5P.MultiChoice 1.16`. */
  readonly library: string;
  /** The keys that are defined at that place, in semantics order. */
  readonly known: readonly string[];
}

/** What the walk found. */
export interface SkeletonFields {
  readonly libraries: readonly SkeletonLibraryUse[];
  readonly texts: readonly SkeletonTextField[];
  readonly unknownKeys: readonly SkeletonUnknownKey[];
}

type Field = ISemanticsEntry & { readonly isSubContent?: boolean };
interface Walk {
  readonly found: {
    libraries: SkeletonLibraryUse[];
    texts: SkeletonTextField[];
    unknownKeys: SkeletonUnknownKey[];
  };
  readonly catalogue: InstalledLibraryCatalogue;
  /** The library whose semantics are walked at this place. */
  readonly library: string;
  /** False inside a sub-content its field does not offer: that is reported, and its keys are another library's. */
  readonly judgeKeys: boolean;
}

// WHY: H5P's library widget stores these keys on a sub-content node beside `params` (h5peditor-library.js); no
// semantics define them.
const NODE_KEYS: readonly string[] = ['library', 'params', 'metadata', 'subContentId'];

// WHY: H5PEditor.BranchingScenario writes each content item's index as `contentId`, which its semantics do not
// define (the player numbers the items again on load); an exported case holds it, so it is not a misspelling.
const EDITOR_KEYS: Readonly<Record<string, readonly string[]>> = { 'H5P.BranchingScenario': ['contentId'] };

// WHY: content.json nests about 15 levels; a bound keeps a malformed skeleton from exhausting the stack.
const MAX_DEPTH = 100;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionNames = (field: Field): string[] =>
  (field.options ?? []).flatMap((option: unknown) => {
    const name = typeof option === 'string' ? option : (option as { name?: unknown } | null)?.name;
    return typeof name === 'string' ? [name] : [];
  });

function collectUnknownKeys(
  value: Record<string, unknown>,
  known: readonly string[],
  path: SkeletonPath,
  walk: Walk,
) {
  if (!walk.judgeKeys) return;
  for (const key of Object.keys(value).filter((name) => !known.includes(name)))
    walk.found.unknownKeys.push({ path: [...path, key], library: walk.library, known });
}

function walkValue(field: Field, value: unknown, path: SkeletonPath, walk: Walk): void {
  if (value === undefined || path.length > MAX_DEPTH) return;
  const fields = (field.fields ?? []) as Field[];
  const [only] = fields;
  if (field.type === 'group' && fields.length === 1 && only && !field.isSubContent) {
    // WHY: H5P stores a group of one field as that field's value (the semantics defaults' flattening rule).
    walkValue({ ...only, name: field.name }, value, path, walk);
  } else if (field.type === 'group' && isObject(value)) {
    walkFields(fields, value, path, walk, field.isSubContent ? ['subContentId'] : []);
  } else if (field.type === 'list' && Array.isArray(value) && field.field) {
    const item = field.field as Field;
    value.forEach((entry: unknown, index) => walkValue(item, entry, [...path, index], walk));
  } else if (field.type === 'library' && isObject(value) && typeof value.library === 'string') {
    const offered = optionNames(field);
    walk.found.libraries.push({ path: [...path, 'library'], library: value.library, offered });
    const semantics = walk.catalogue.semanticsOf(value.library);
    // WHY: a library that is not installed is reported at its `library` key; without semantics its keys mean nothing.
    if (!semantics) return;
    const judgeKeys = walk.judgeKeys && offered.includes(value.library);
    const inside: Walk = { ...walk, library: value.library, judgeKeys };
    collectUnknownKeys(value, NODE_KEYS, path, inside);
    if (isObject(value.params)) walkFields(semantics as Field[], value.params, [...path, 'params'], inside);
  } else if (field.type === 'text' && typeof value === 'string') {
    const maxLength = typeof field.maxLength === 'number' ? field.maxLength : undefined;
    walk.found.texts.push({ path, text: value, ...(maxLength === undefined ? {} : { maxLength }) });
  }
}

function walkFields(
  fields: readonly Field[],
  params: Record<string, unknown>,
  path: SkeletonPath,
  walk: Walk,
  extraKeys: readonly string[] = [],
): void {
  const editorKeys = EDITOR_KEYS[walk.library.split(' ')[0] ?? ''] ?? [];
  collectUnknownKeys(params, [...fields.map((field) => field.name), ...extraKeys, ...editorKeys], path, walk);
  for (const field of fields) walkValue(field, params[field.name], [...path, field.name], walk);
}

/**
 * Walks a skeleton's parameters along the semantics of its main library and of every sub-content.
 * @param params - The skeleton's `params`.
 * @param library - The main library as `H5P.Name x.y`, named by the unknown keys of its own fields.
 * @param semantics - The main library's semantics (from the catalogue).
 * @param catalogue - The installed libraries.
 * @returns The sub-content libraries, text fields and unknown keys, in document order.
 * @spec PED-010
 */
export function walkSkeletonFields(
  params: Readonly<Record<string, unknown>>,
  library: string,
  semantics: readonly ISemanticsEntry[],
  catalogue: InstalledLibraryCatalogue,
): SkeletonFields {
  const found: Walk['found'] = { libraries: [], texts: [], unknownKeys: [] };
  const walk: Walk = { found, catalogue, library, judgeKeys: true };
  walkFields(semantics as Field[], params, ['params'], walk);
  return walk.found;
}
