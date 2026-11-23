/**
 * semanticsConformance — makes H5P content parameters hold only what their library's semantics describe: no key a
 * field list does not name, and every number, boolean, select and file value of its field's type.
 *
 * Why: the H5P player and editor read parameters key by key, also keys and value shapes no field describes, and
 *      write some of them into the page. H5P's own server software (`H5PContentValidator`) removes every key the
 *      semantics do not name and fits each value to its type before content is shown; Lumi's SemanticsEnforcer
 *      cleans text and checks sub-content only (D-123). This module does the rest, on every save, before Lumi.
 * Spec: SEC-008, H5P-002
 * Invariants:
 *   - An object whose keys a field list defines (a library's parameters, a group with several fields) keeps only
 *     those keys, and a `subContentId` that is a UUID. A sub-content entry keeps `library`, `params`, `subContentId`
 *     (a UUID), `metadata` (an object) and its field's `extraAttributes`.
 *   - A number is a finite number within the field's `min` and `max` (a numeric string becomes a number); a boolean
 *     a boolean; a select one of its option values (each of them, when it takes several); a file value as
 *     ./fileValueConformance.ts says; video and audio a list of such values.
 *   - A list holds at most its field's `max` items; what comes after them is cut, as H5P's own server software
 *     cuts it (the editor never adds more than `max`).
 *   - The address of a link field holds no character that can end the HTML attribute it is written into
 *     (./linkAddressConformance.ts, D-140); it is fitted in `apply`, so on a save it is the cleaned text that is read.
 *   - What does not fit is removed, never refused: the key from its object, the item from its list. Text is not
 *     judged here (./lumiTextSanitizer.ts), nor structure the walker refuses (./paramsWalker.ts).
 *   - Nothing changes before `apply`: the fixes are collected during the walk, so a refusal the walk or the checks
 *     after it raise leaves the parameters as they came.
 * Collaborators: ./paramsWalker.ts (calls `visit` and `onFields`), ./fileValueConformance.ts,
 *   ./linkAddressConformance.ts, ./SubContentPolicy.ts (runs it on every save).
 * Tests: apps/server/test/h5p/semantics/semanticsConformance.test.ts,
 *   apps/server/test/h5p/semantics/semanticsConformance.property.test.ts
 */
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { fileValueFixes, finiteNumber, type ConformanceFix, type FileKind } from './fileValueConformance.js';
import { fitLinkAddress, isLinkField } from './linkAddressConformance.js';
import type { FieldsVisitor, ParamsVisit, ParamsVisitor } from './paramsWalker.js';

// UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/SemanticsEnforcer.ts lists these checks as not yet done ("Filter out params that are not valid per se").
// Remove this module when Lumi's enforcer removes undeclared keys and fits values as H5P's PHP validator does.
const SUB_CONTENT_KEYS = ['library', 'params', 'subContentId', 'metadata'];
/** H5P's own pattern for a sub-content ID. */
const SUB_CONTENT_ID = /^\{?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}?$/;
const LEAF_TYPES = new Set(['number', 'boolean', 'select']);
const UNFIT = Symbol('unfit');

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isSubContentId = (value: unknown): boolean => typeof value === 'string' && SUB_CONTENT_ID.test(value);

/** A select's allowed values, or undefined when its semantics list none (a list the editor fills itself). */
function optionValues(semantics: ISemanticsEntry): Set<unknown> | undefined {
  const options = Array.isArray(semantics.options) ? (semantics.options as unknown[]) : [];
  const values = options.map((option) => (isObject(option) ? option.value : option));
  return values.length > 0 ? new Set(values) : undefined;
}

/** The value of a number, boolean or select field as it may be stored, or `UNFIT`. */
function fittedLeaf(semantics: ISemanticsEntry, value: unknown): unknown {
  if (semantics.type === 'boolean') return typeof value === 'boolean' ? value : UNFIT;
  if (semantics.type === 'number') {
    const fitted = finiteNumber(value);
    if (fitted === undefined) return UNFIT;
    const [min, max] = [finiteNumber(semantics.min), finiteNumber(semantics.max)];
    const raised = min === undefined ? fitted : Math.max(min, fitted);
    return max === undefined ? raised : Math.min(max, raised);
  }
  const allowed = optionValues(semantics);
  const fits = (one: unknown): boolean =>
    allowed ? allowed.has(one) : typeof one === 'string' || typeof one === 'number';
  if (!Array.isArray(value)) return fits(value) ? value : UNFIT;
  // WHY: only a select marked `multiple` stores a list of values; one that fits already is kept as it is.
  if (!(semantics as { multiple?: unknown }).multiple) return UNFIT;
  return (value as unknown[]).every(fits) ? value : (value as unknown[]).filter(fits);
}

/** The items of a list that its field's `max` lets it keep: all of them when it names none. */
function withinMax(semantics: ISemanticsEntry, list: unknown[]): unknown[] {
  const max = finiteNumber(semantics.max);
  return max === undefined || max < 0 || list.length <= max ? list : list.slice(0, Math.floor(max));
}

/** The semantics-conformance of one save: what the walker calls, and the fixes it leads to. */
export interface SemanticsConformance {
  /** For `walkParams`: notes the fixes of each value. */
  readonly visit: ParamsVisitor;
  /** For `walkParams`: notes the keys a field list does not name. */
  readonly onFields: FieldsVisitor;
  /**
   * Makes the noted fixes.
   * @returns How many keys or values were removed or changed.
   */
  apply(): number;
}

/**
 * Starts the conformance of one save.
 * @returns The visitors to hand to `walkParams`, and `apply` to call once the walk and its checks have passed.
 * @spec SEC-008
 */
export function semanticsConformance(): SemanticsConformance {
  const fixes: ConformanceFix[] = [];
  const lists: { readonly list: unknown[]; readonly kept: unknown[] }[] = [];
  const links: Record<string, unknown>[] = [];
  const removeUndeclared = (object: Record<string, unknown>, declared: ReadonlySet<string>): void => {
    for (const [key, value] of Object.entries(object)) {
      if (declared.has(key) || (key === 'subContentId' && isSubContentId(value))) continue;
      fixes.push({ remove: key, from: object });
    }
  };
  const fitFiles = (semantics: ISemanticsEntry, value: unknown, container: object, key: string): void => {
    const kind = semantics.type as FileKind;
    const sources = kind === 'video' || kind === 'audio';
    // WHY: the walker has refused a file value that is no object; video and audio hold a list of them.
    if (sources && !Array.isArray(value))
      fixes.push({ remove: key, from: container as Record<string, unknown> });
    for (const file of sources && Array.isArray(value) ? (value as unknown[]) : sources ? [] : [value]) {
      if (isObject(file)) fixes.push(...fileValueFixes(file, kind, semantics.extraAttributes));
    }
  };
  const visit = ({ semantics, value, container, key }: ParamsVisit): void | 'skip' => {
    const { type } = semantics;
    if (type === 'library' && isObject(value)) {
      removeUndeclared(value, new Set([...SUB_CONTENT_KEYS, ...(semantics.extraAttributes ?? [])]));
      if ('subContentId' in value && !isSubContentId(value.subContentId)) {
        fixes.push({ remove: 'subContentId', from: value });
      }
      if ('metadata' in value && !isObject(value.metadata)) fixes.push({ remove: 'metadata', from: value });
    } else if (type === 'list' && Array.isArray(value)) {
      const items = withinMax(semantics, value as unknown[]);
      const field = semantics.field as ISemanticsEntry | undefined;
      if (field && LEAF_TYPES.has(field.type)) {
        lists.push({
          list: value,
          kept: items.map((item) => fittedLeaf(field, item)).filter((i) => i !== UNFIT),
        });
        return 'skip';
      }
      // WHY: the walk still reads the items past `max`, so a refusal inside them has its say before the cut.
      if (items !== value) lists.push({ list: value, kept: items });
    } else if (LEAF_TYPES.has(type) && !Array.isArray(container)) {
      const fitted = fittedLeaf(semantics, value);
      if (fitted === UNFIT) fixes.push({ remove: String(key), from: container });
      else if (fitted !== value) fixes.push({ set: String(key), on: container, to: fitted });
    } else if (type === 'file' || type === 'image' || type === 'video' || type === 'audio') {
      fitFiles(semantics, value, container, String(key));
    } else if (isLinkField(semantics) && isObject(value)) {
      links.push(value);
    }
  };
  return {
    visit,
    onFields: (fields, object) => removeUndeclared(object, new Set(fields.map((field) => field.name))),
    apply: () => {
      let changed = fixes.length;
      for (const fix of fixes) {
        if ('remove' in fix) delete fix.from[fix.remove];
        else fix.on[fix.set] = fix.to;
      }
      for (const { list, kept } of lists) {
        changed += list.length === kept.length && list.every((item, at) => item === kept[at]) ? 0 : 1;
        // WHY: item by item; a spread of a long list into `splice` passes more arguments than a call may take.
        kept.forEach((item, at) => (list[at] = item));
        list.length = kept.length;
      }
      // WHY: last, and on the value as it is now: on a save the walk has cleaned the address's text by then.
      for (const link of links) changed += fitLinkAddress(link) ? 1 : 0;
      return changed;
    },
  };
}
