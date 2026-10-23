/**
 * contentTypeName — the name of an H5P content type in the page language, from its machine name.
 *
 * Why: the API returns machine names (`H5P.MultiChoice`), which teachers do not read as names. The ten authorable
 *      types (H5P-002) have names in the locale files; anything else shows its machine name without the prefix.
 * Spec: H5P-002, PROD-012
 * Invariants:
 *   - Never throws; an unknown or malformed machine name comes back readable.
 * Collaborators: ./translate.ts, ../features/portal/ActivityList.tsx.
 * Tests: apps/web/test/i18n/contentTypeName.test.ts
 */
import { t, type Locale, type MessageKey } from './translate';

/** The ten authorable content types (H5P-002), by the part after `H5P.`. */
export const AUTHORABLE_TYPES = [
  'CoursePresentation',
  'InteractiveVideo',
  'QuestionSet',
  'InteractiveBook',
  'Column',
  'DragText',
  'MultiChoice',
  'Blanks',
  'ImageHotspots',
  'BranchingScenario',
] as const;

const isAuthorable = (name: string): name is (typeof AUTHORABLE_TYPES)[number] =>
  (AUTHORABLE_TYPES as readonly string[]).includes(name);

/**
 * The display name of a content type.
 * @param machineName - E.g. `H5P.MultiChoice`.
 * @param locale - The page locale.
 * @returns E.g. `Fleirval` in Nynorsk.
 */
export function contentTypeName(machineName: string, locale: Locale): string {
  const short = machineName.replace(/^H5P\./, '');
  if (!isAuthorable(short)) return short;
  return t(`contentType.${short}` as MessageKey, locale);
}
