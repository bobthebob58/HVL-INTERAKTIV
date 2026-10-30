/**
 * studioFilters — reads the studio's filters and course back from a page address (`?fase=&type=&tid=&emne=`), and
 * checks a pattern ID from the address.
 *
 * Why: PED-003 keeps the catalogue's filter state in the address, so a shared address shows the same view; the
 *      planner (`?emne=`, PED-031) and a pattern's page (`?fase=&emne=`, D-085) read the same parameters. The
 *      address is typed by anyone, so every value is checked before a page uses it.
 * Spec: PED-003, PED-031, PED-030
 * Invariants:
 *   - A value outside its list (phase, content type), a build time that is not a whole number of 1–600 minutes, or a
 *     course code that is not valid after D-087's normalisation is left out, never passed on; the first value of a
 *     repeated parameter counts.
 *   - The lists mirror packages/api-contract (`PHASE_KEYS`, `AUTHORABLE_CONTENT_TYPES`, `COURSE_CODE_PATTERN`,
 *     `patternIdSchema`); the web app imports only types from the contract, so zod stays out of the browser bundle,
 *     and a test keeps the copies equal.
 * Collaborators: ./paths.ts (`STUDIO_QUERY`, the builders), packages/api-contract/src/studio.ts,
 *   packages/api-contract/src/learningDesign.ts (`courseCodeSchema`), the studio and planner views.
 * Tests: apps/web/test/config/studioFilters.test.ts
 */
import type { AuthorableContentType, PhaseKey } from '@hvl-interaktiv/api-contract';
import { STUDIO_QUERY, type StudioFilters } from './paths';

/** The phase keys in content order (the contract's `PHASE_KEYS`). */
export const STUDIO_PHASE_KEYS: readonly PhaseKey[] = ['forarbeid', 'underveis', 'etterarbeid'];

/** The ten authorable content types (the contract's `AUTHORABLE_CONTENT_TYPES`). */
export const STUDIO_CONTENT_TYPES: readonly AuthorableContentType[] = [
  'H5P.CoursePresentation',
  'H5P.InteractiveVideo',
  'H5P.QuestionSet',
  'H5P.InteractiveBook',
  'H5P.Column',
  'H5P.DragText',
  'H5P.MultiChoice',
  'H5P.Blanks',
  'H5P.ImageHotspots',
  'H5P.BranchingScenario',
];

/** The longest build time a pattern may state, in minutes (the contract's `buildMinutes`). */
export const MAX_BUILD_MINUTES = 600;

/** A normalised course code (the contract's `COURSE_CODE_PATTERN`, D-087). */
export const STUDIO_COURSE_CODE_PATTERN = /^[A-ZÆØÅ0-9][A-ZÆØÅ0-9-]{1,19}$/;

/** A pattern ID, the name of its folder in `content/` (the contract's `patternIdSchema`). */
export const PATTERN_ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/;

/**
 * Whether a value from an address can be a pattern ID at all.
 * @param value - e.g. the `[patternId]` segment of `/laeringsdesign/monster/[patternId]`.
 * @returns True for `fa-video`; false for `../x`, `FA-VIDEO` or an empty value.
 */
export const isPatternId = (value: string): boolean => PATTERN_ID_PATTERN.test(value);

const oneOf = <T extends string>(list: readonly T[], value: string | null): T | undefined =>
  list.find((item) => item === value);

/**
 * Normalises a course code as the server does (D-087): NFC, trimmed, upper case, inner spaces removed.
 * @param value - What the author or the address gave, e.g. ` syk 110 `.
 * @returns The code, e.g. `SYK110`, or undefined when it is not a valid course code.
 */
export function normaliseCourseCode(value: string | null | undefined): string | undefined {
  const code = (value ?? '').normalize('NFC').trim().toUpperCase().replace(/\s+/g, '');
  return STUDIO_COURSE_CODE_PATTERN.test(code) ? code : undefined;
}

/**
 * Reads the studio's filters and course from an address's query.
 * @param query - The query, e.g. `useSearchParams()` or `new URLSearchParams(location.search)`.
 * @returns The valid values; unknown and invalid ones are left out.
 */
export function readStudioFilters(query: Pick<URLSearchParams, 'get'>): StudioFilters {
  const minutes = query.get(STUDIO_QUERY.buildTime);
  const buildTime = minutes !== null && /^\d{1,3}$/.test(minutes) ? Number(minutes) : undefined;
  const filters = {
    phase: oneOf(STUDIO_PHASE_KEYS, query.get(STUDIO_QUERY.phase)),
    type: oneOf(STUDIO_CONTENT_TYPES, query.get(STUDIO_QUERY.type)),
    buildTime:
      buildTime !== undefined && buildTime >= 1 && buildTime <= MAX_BUILD_MINUTES ? buildTime : undefined,
    course: normaliseCourseCode(query.get(STUDIO_QUERY.course)),
  };
  // WHY: a page spreads these into a new address or compares them with the current ones; a key that is present
  // but undefined would make `{}` and `{ phase: undefined }` differ.
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined),
  ) as StudioFilters;
}
