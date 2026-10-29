/**
 * mappeCriteria — loads the pedagogisk mappe criteria in Nynorsk, Bokmål and English and merges them into one list of
 * criteria sets with each text in the three languages, after checking that the languages agree.
 *
 * Why: switching the criteria set must change every criterion text and the reader's guide with no code change
 *      (MAPPE-002); the three files must hold the same sets and criteria (D-082: "the three criteria files the same
 *      criteria IDs"), or a Bokmål portfolio would answer other criteria than a Nynorsk one.
 * Spec: MAPPE-002, PROD-012
 * Invariants:
 *   - Each file is read with the strict schema of ./mappeCriteriaFile.ts; every problem names the file, line and key.
 *   - nb and en have the same set IDs in the same order as nn, the same criterion IDs in the same order in each set,
 *     the same limits, and an attachment hint on the same criteria; differences are reported in nb or en.
 *   - The default set (`DEFAULT_CRITERIA_SET` of the contract) must exist, since a request may name no set.
 * Collaborators: ./mappeContent.ts (the caller), ./mappeCriteriaFile.ts, ./contentSource.ts,
 *   @hvl-interaktiv/api-contract.
 * Tests: apps/server/test/learningDesign/content/mappeCriteria.test.ts
 */
import { DEFAULT_CRITERIA_SET } from '@hvl-interaktiv/api-contract';
import type { Locale } from '../../i18n/translate.js';
import type { ContentProblem } from './contentProblem.js';
import { problemAt, readContentSource, type ContentSource } from './contentSource.js';
import type { LocalisedText } from './contentText.js';
import {
  mappeCriteriaFileSchema,
  type MappeCriteriaFile,
  type MappeCriteriaFileSet,
  type MappeLimit,
} from './mappeCriteriaFile.js';

/** The criteria file of one language, relative to the content folder. */
export const mappeCriteriaFileOf = (language: Locale): string => `mappe/criteria.${language}.yaml`;

/** One criterion with its texts in nn, nb and en. */
export interface MappeCriterion {
  readonly id: string;
  readonly text: LocalisedText;
  readonly chapter: LocalisedText;
  readonly attachment?: LocalisedText;
}

/** One criteria set with its texts in nn, nb and en. */
export interface MappeCriteriaSet {
  readonly id: string;
  readonly title: LocalisedText;
  readonly limits: { readonly del1Words: MappeLimit; readonly attachments: MappeLimit };
  readonly criteria: readonly MappeCriterion[];
}

type Loaded = ContentSource<MappeCriteriaFile> & { readonly language: Locale };

const NN = 'criteria.nn.yaml';
const sameLimit = (a: MappeLimit, b: MappeLimit) => a.value === b.value && a.verify === b.verify;

function setProblems(other: Loaded, mine: MappeCriteriaFileSet, theirs: MappeCriteriaFileSet, index: number) {
  const problems: ContentProblem[] = [];
  const at = (path: (string | number)[], message: string) =>
    problemAt(other, ['sets', index, ...path], message);
  for (const key of ['del1Words', 'attachments'] as const) {
    if (!sameLimit(mine.limits[key], theirs.limits[key]))
      problems.push(at(['limits', key], `differs from ${NN}; the limits are the same in every language`));
  }
  const ids = (set: MappeCriteriaFileSet) => set.criteria.map(({ id }) => id).join(', ');
  if (ids(mine) !== ids(theirs)) {
    problems.push(at(['criteria'], `has the criteria ${ids(theirs)}; ${NN} has ${ids(mine)} in this order`));
    return problems;
  }
  mine.criteria.forEach((criterion, position) => {
    if ((criterion.attachment === undefined) !== (theirs.criteria[position]?.attachment === undefined))
      problems.push(
        at(['criteria', position], `has an attachment hint where ${NN} has none, or none where it has one`),
      );
  });
  return problems;
}

function parityProblems(reference: Loaded, others: readonly Loaded[]): ContentProblem[] {
  const ids = (file: Loaded) => file.value.sets.map(({ id }) => id).join(', ');
  return others.flatMap((other) => {
    if (ids(other) !== ids(reference)) {
      return [
        problemAt(other, ['sets'], `has the sets ${ids(other)}; ${NN} has ${ids(reference)} in this order`),
      ];
    }
    return reference.value.sets.flatMap((set, index) => {
      const theirs = other.value.sets[index];
      return theirs ? setProblems(other, set, theirs, index) : [];
    });
  });
}

const localised = (files: readonly Loaded[], text: (file: Loaded) => string): LocalisedText =>
  Object.fromEntries(files.map((file) => [file.language, text(file)])) as Record<Locale, string>;

function merged(files: readonly Loaded[]): MappeCriteriaSet[] {
  const [reference] = files;
  return (reference?.value.sets ?? []).map((set, index) => {
    const setOf = (file: Loaded) => file.value.sets[index] ?? set;
    return {
      id: set.id,
      title: localised(files, (file) => setOf(file).title),
      limits: set.limits,
      criteria: set.criteria.map((criterion, position) => {
        const of = (file: Loaded) => setOf(file).criteria[position] ?? criterion;
        const attachment = criterion.attachment;
        return {
          id: criterion.id,
          text: localised(files, (file) => of(file).text),
          chapter: localised(files, (file) => of(file).chapter),
          ...(attachment === undefined
            ? {}
            : { attachment: localised(files, (file) => of(file).attachment ?? attachment) }),
        };
      }),
    };
  });
}

/**
 * Loads and compares the three criteria files.
 * @param files - Each language's absolute path, in the order nn, nb, en.
 * @returns The merged sets, or every problem.
 * @spec MAPPE-002
 */
export function loadMappeCriteria(
  files: readonly { readonly language: Locale; readonly path: string }[],
):
  | { readonly ok: true; readonly sets: readonly MappeCriteriaSet[] }
  | { readonly ok: false; readonly problems: readonly ContentProblem[] } {
  const problems: ContentProblem[] = [];
  const loaded: Loaded[] = [];
  for (const { language, path } of files) {
    const result = readContentSource(path, mappeCriteriaFileSchema, 'yaml');
    if (result.ok) loaded.push({ ...result, language });
    else problems.push(...result.problems);
  }
  const [reference, ...others] = loaded;
  if (problems.length > 0 || !reference) return { ok: false, problems };
  if (!reference.value.sets.some((set) => set.id === DEFAULT_CRITERIA_SET)) {
    problems.push(
      problemAt(
        reference,
        ['sets'],
        `has no set "${DEFAULT_CRITERIA_SET}", the set a request uses by default`,
      ),
    );
  }
  problems.push(...parityProblems(reference, others));
  return problems.length > 0 ? { ok: false, problems } : { ok: true, sets: merged(loaded) };
}
