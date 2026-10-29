/**
 * Tests for the pedagogisk mappe content: the fixture's template and two criteria sets load in nn, nb and en; no
 * mappe file at all is "no portfolio yet"; some files only is a problem naming each missing one; the criteria files'
 * schema (quoted IDs, unique IDs, limits with defaults) and their parity across the languages, each problem with its
 * file, line and key.
 *
 * Spec: MAPPE-002
 */
import { afterAll, describe, expect, it } from 'vitest';
import type { ContentProblem } from '../../../src/learningDesign/content/contentProblem.js';
import { describeMappeContent, MAPPE_FILES } from '../../../src/learningDesign/content/mappeContent.js';
import {
  editedMappeFixture,
  FIXTURE_SETS,
  fixtureMappe,
  loadFixtureMappe,
  removeMappeFixtureCopies,
} from '../../support/mappeFixture.js';

const NN = 'mappe/criteria.nn.yaml';
const NB = 'mappe/criteria.nb.yaml';
const EN = 'mappe/criteria.en.yaml';

const problemsOf = (edits: Parameters<typeof editedMappeFixture>[0]) => {
  const loaded = loadFixtureMappe(editedMappeFixture(edits));
  if (loaded.ok) throw new Error('expected the mappe content to be refused');
  return loaded.problems.map((p: ContentProblem) => ({ ...p, file: p.file.split('/').slice(-2).join('/') }));
};

afterAll(removeMappeFixtureCopies);

describe('[MAPPE-002] loading the mappe content', () => {
  it('[MAPPE-002] loads the fixture: three templates and two criteria sets with every text in nn, nb and en', () => {
    // Act
    const { portfolio } = fixtureMappe();
    // Assert
    expect(Object.keys(portfolio?.templates ?? {})).toEqual(['nn', 'nb', 'en']);
    expect(portfolio?.criteriaSets.map((set) => set.id)).toEqual([FIXTURE_SETS.default, FIXTURE_SETS.other]);
    const [first, second] = portfolio?.criteriaSets ?? [];
    expect(first?.criteria.map((criterion) => criterion.id)).toEqual(['1.1', '2.3', '3.1']);
    expect(first?.criteria[0]?.text.en).toBe('Criterion text one-one from the 2025 test set');
    expect(first?.criteria[1]?.attachment).toBeUndefined();
    expect(second?.limits).toEqual({
      del1Words: { value: 100, verify: false },
      attachments: { value: 2, verify: false },
    });
    expect(describeMappeContent(fixtureMappe())).toBe('mappe template and 2 criteria sets in nn, nb and en');
  });

  it('[MAPPE-002] reads no mappe file at all as no portfolio yet, and some files only as each missing one named', () => {
    // Arrange
    const none = Object.fromEntries(MAPPE_FILES.map((file) => [file, null]));
    // Act
    const empty = loadFixtureMappe(editedMappeFixture(none));
    const partial = problemsOf({ 'mappe/template.nb.md': null, [EN]: null });
    // Assert
    expect(empty).toEqual({ ok: true, value: {} });
    expect(describeMappeContent(empty.ok ? empty.value : {})).toBe('no mappe yet');
    expect(partial.map(({ file, message }) => [file, message.split(':')[0]])).toEqual([
      [EN, 'is missing'],
      ['mappe/template.nb.md', 'is missing'],
    ]);
  });

  it('[MAPPE-002] fills a left-out limit with its default, to be verified', () => {
    // Arrange
    const withoutLimits = (text: string) => text.replace(/ {4}limits:\n(?: {6}.*\n)+/g, '');
    // Act
    const loaded = loadFixtureMappe(
      editedMappeFixture({ [NN]: withoutLimits, [NB]: withoutLimits, [EN]: withoutLimits }),
    );
    // Assert
    const sets = loaded.ok ? loaded.value.portfolio?.criteriaSets : [];
    expect(sets?.map((set) => set.limits)).toEqual([
      { del1Words: { value: 7500, verify: true }, attachments: { value: 11, verify: true } },
      { del1Words: { value: 7500, verify: true }, attachments: { value: 11, verify: true } },
    ]);
  });

  it.each([
    [
      'a criterion ID written as a number',
      (text: string) => text.replace("id: '1.1'", 'id: 1.10'),
      {
        line: 14,
        key: 'sets[hvl-merittering-2025].criteria[#1].id',
        message: expect.stringMatching(/write the ID in quotes, like "1\.1"/),
      },
    ],
    [
      'a repeated criterion ID',
      (text: string) => text.replace("id: '2.3'", "id: '1.1'"),
      {
        line: 18,
        key: 'sets[hvl-merittering-2025].criteria[1.1].id',
        message: 'repeats the criterion ID "1.1"',
      },
    ],
    [
      'an unknown key',
      (text: string) =>
        text.replace('    title: Testsett 2025\n', '    title: Testsett 2025\n    colour: blue\n'),
      {
        line: 6,
        key: 'sets[hvl-merittering-2025].colour',
        message: 'is not a known key (check the spelling)',
      },
    ],
    [
      'a limit without its verify flag',
      (text: string) => text.replace('        value: 7500\n        verify: true\n', '        value: 7500\n'),
      { line: 7, key: 'sets[hvl-merittering-2025].limits.del1Words.verify', message: 'is missing' },
    ],
  ])('[MAPPE-002] refuses %s in a criteria file, naming its line and key', (_name, edit, problem) => {
    expect(problemsOf({ [NN]: edit })).toEqual([{ file: NN, ...problem }]);
  });

  it('[MAPPE-002] needs the default set, and nb and en with the same sets, criteria, limits and hints as nn', () => {
    // Act
    const noDefault = problemsOf({
      [NN]: (text) => text.replace('id: hvl-merittering-2025', 'id: hvl-merittering-2023'),
      [NB]: (text) => text.replace('id: hvl-merittering-2025', 'id: hvl-merittering-2023'),
      [EN]: (text) => text.replace('id: hvl-merittering-2025', 'id: hvl-merittering-2023'),
    });
    const drift = problemsOf({
      [NB]: (text) => text.replace('id: A.2', 'id: A.3'),
      [EN]: (text) =>
        text
          .replace('        value: 100\n', '        value: 120\n')
          .replace('        attachment: Test attachment A\n', ''),
    });
    // Assert
    expect(noDefault).toEqual([
      {
        file: NN,
        line: 3,
        key: 'sets',
        message: 'has no set "hvl-merittering-2025", the set a request uses by default',
      },
    ]);
    expect(drift).toEqual([
      {
        file: EN,
        line: 28,
        key: 'sets[fixture-2027].limits.del1Words',
        message: expect.stringMatching(/^differs from criteria\.nn\.yaml/),
      },
      {
        file: EN,
        line: 35,
        key: 'sets[fixture-2027].criteria[A.1]',
        message: expect.stringMatching(/attachment hint/),
      },
      {
        file: NB,
        line: 34,
        key: 'sets[fixture-2027].criteria',
        message: 'has the criteria A.1, A.3; criteria.nn.yaml has A.1, A.2 in this order',
      },
    ]);
  });
});
