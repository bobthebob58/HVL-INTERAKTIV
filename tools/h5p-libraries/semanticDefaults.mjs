/**
 * semanticDefaults — fills an example's parameters with the defaults a library's semantics give, in the library's
 * own Nynorsk translation, as the H5P editor does when an author creates new content.
 *
 * Why: the example activities should look like content an HVL author made in Nynorsk (button labels, feedback
 *      texts), without hand-copying dozens of UI strings per content type. The library's `language/nn.json` mirrors
 *      `semantics.json` and may override labels and defaults (D-078).
 * Spec: H5P-003, H5P-008
 * Invariants:
 *   - Only fields with a `default` get a value; groups get an object only when a child has one; lists stay empty.
 *   - Given values always win: objects merge recursively, arrays and scalars replace the default.
 *   - Sub-content (`{ library: "H5P.Name x.y", params }`) gets its own library's defaults, recursively.
 * Collaborators: ./packContentTypes.mjs.
 * Tests: tools/h5p-libraries/test/semanticDefaults.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Applies a translation (same shape as semantics) to semantics: labels and defaults are replaced.
 * @param {object[]} fields - Semantics fields.
 * @param {object[] | undefined} translation - The matching translated fields.
 * @returns {object[]} Translated fields.
 */
export function translateSemantics(fields, translation) {
  return fields.map((field, i) => {
    const t = translation?.[i] ?? {};
    const out = { ...field, ...(t.default !== undefined ? { default: t.default } : {}) };
    if (field.fields) out.fields = translateSemantics(field.fields, t.fields);
    if (field.field) out.field = translateSemantics([field.field], t.field ? [t.field] : undefined)[0];
    return out;
  });
}

/**
 * The default parameter object for a list of semantics fields.
 * @param {object[]} fields - Semantics fields.
 * @returns {Record<string, unknown>} Defaults by field name.
 */
export function defaultsOf(fields) {
  const out = {};
  for (const field of fields) {
    if (field.type === 'group') {
      // WHY: a group with one field is stored as that field's value (H5P editor behaviour).
      const inner = defaultsOf(field.fields ?? []);
      if (field.fields?.length === 1) {
        if (field.fields[0].name in inner) out[field.name] = inner[field.fields[0].name];
      } else if (Object.keys(inner).length > 0) out[field.name] = inner;
    } else if (field.default !== undefined) {
      out[field.name] = field.default;
    }
  }
  return out;
}

/**
 * Merges given values over defaults.
 * @param {unknown} defaults - Default value.
 * @param {unknown} given - Given value.
 * @returns {unknown} The merged value.
 */
export function mergeOver(defaults, given) {
  if (given === undefined) return defaults;
  if (!isObject(defaults) || !isObject(given)) return given;
  const out = { ...defaults };
  for (const [key, value] of Object.entries(given)) out[key] = mergeOver(defaults[key], value);
  return out;
}

/**
 * Loads a library's Nynorsk defaults.
 * @param {string} libraryDir - The library folder.
 * @returns {Record<string, unknown>} Default parameters.
 */
export function libraryDefaults(libraryDir) {
  const semanticsFile = join(libraryDir, 'semantics.json');
  if (!existsSync(semanticsFile)) return {};
  const semantics = JSON.parse(readFileSync(semanticsFile, 'utf8'));
  const nn = join(libraryDir, 'language', 'nn.json');
  const translation = existsSync(nn) ? JSON.parse(readFileSync(nn, 'utf8')).semantics : undefined;
  return defaultsOf(translateSemantics(semantics, translation));
}

/**
 * Fills parameters and all their sub-content with defaults.
 * @param {unknown} params - Given parameters.
 * @param {(library: string) => Record<string, unknown>} defaultsFor - Defaults by `H5P.Name x.y`.
 * @param {string} library - The library these parameters belong to.
 * @returns {unknown} Completed parameters.
 */
export function withDefaults(params, defaultsFor, library) {
  const fill = (value) => {
    if (Array.isArray(value)) return value.map(fill);
    if (!isObject(value)) return value;
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v)]));
    if (typeof out.library === 'string' && isObject(out.params)) {
      out.params = withDefaults(out.params, defaultsFor, out.library);
    }
    return out;
  };
  return mergeOver(defaultsFor(library), fill(params));
}
